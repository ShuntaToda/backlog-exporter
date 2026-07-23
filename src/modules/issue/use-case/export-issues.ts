import path from 'node:path'

import {writeProgress} from '../../../shared/console/progress.js'
import {Logger} from '../../../shared/ports.js'
import {fileSize, writeBinaryFile, writeMarkdownFile} from '../../../shared/storage/markdown-store.js'
import {appendLog} from '../../../shared/storage/update-log.js'
import {filterIssuesUpdatedSince} from '../domain/issue-filter.js'
import {buildIssueMarkdown} from '../domain/issue-markdown.js'
import {attachmentMarkdownLink, attachmentRelativePath, issueRelativePath, issueUrl} from '../domain/issue-path.js'
import {IssueRepository} from '../domain/issue-repository.js'
import {Issue, IssueComment} from '../domain/issue.js'

export interface ExportIssuesDeps {
  issueRepository: IssueRepository
  logger: Logger
}

export interface ExportIssuesOptions {
  count?: number
  domain: string
  downloadAttachments?: boolean
  issueIdOrKeys?: string[]
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  lastUpdated?: string
  outputDir: string
  projectId: number
  statusId?: string
}

export async function exportIssues(deps: ExportIssuesDeps, options: ExportIssuesOptions): Promise<void> {
  const {logger} = deps
  logger.log('課題の取得を開始します...')

  const allIssues =
    options.issueIdOrKeys && options.issueIdOrKeys.length > 0
      ? await fetchIssuesByIdOrKeys(deps, options.issueIdOrKeys)
      : await fetchAllIssues(deps, options)

  logger.log(`\n合計 ${allIssues.length}件の課題が見つかりました。`)

  const filteredIssues = filterIssuesUpdatedSince(allIssues, options.lastUpdated)
  if (options.lastUpdated) {
    logger.log(`前回の更新日時(${options.lastUpdated})以降に更新された${filteredIssues.length}件の課題を処理します。`)
  }

  if (filteredIssues.length === 0) {
    logger.log('更新が必要な課題はありません。')
    return
  }

  logger.log('課題を保存しています...')

  for (const [index, issue] of filteredIssues.entries()) {
    try {
      writeProgress(`課題を保存中... (${index + 1}/${filteredIssues.length}件)`)
      // eslint-disable-next-line no-await-in-loop
      await saveIssue(deps, issue, options)
    } catch (error) {
      logger.warn(
        `課題 ${issue.issueKey} の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  logger.log('\n課題のダウンロードが完了しました！')
}

async function fetchIssuesByIdOrKeys(deps: ExportIssuesDeps, issueIdOrKeys: string[]): Promise<Issue[]> {
  const issues: Issue[] = []
  for (const [index, issueIdOrKey] of issueIdOrKeys.entries()) {
    try {
      writeProgress(`課題を取得中... (${index + 1}/${issueIdOrKeys.length}件)`)
      // eslint-disable-next-line no-await-in-loop
      issues.push(await deps.issueRepository.fetchByIdOrKey(issueIdOrKey))
    } catch (error) {
      deps.logger.warn(
        `課題 ${issueIdOrKey} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return issues
}

async function fetchAllIssues(deps: ExportIssuesDeps, options: ExportIssuesOptions): Promise<Issue[]> {
  const pageSize = Math.min(options.count ?? 5000, 100)
  const issues: Issue[] = []

  try {
    for (;;) {
      writeProgress(`課題を取得中... (${issues.length}件取得済み)`)
      // eslint-disable-next-line no-await-in-loop
      const page = await deps.issueRepository.fetchPage({
        count: pageSize,
        offset: issues.length,
        projectId: options.projectId,
        statusId: options.statusId,
      })
      issues.push(...page)

      if (page.length < pageSize) {
        break
      }
    }
  } catch (error) {
    throw new Error(`課題の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
  }

  return issues
}

async function saveIssue(deps: ExportIssuesDeps, issue: Issue, options: ExportIssuesOptions): Promise<void> {
  const backlogIssueUrl = issueUrl(options.domain, issue.issueKey)

  // コメント取得に失敗しても課題本体は保存する
  let comments: IssueComment[] = []
  try {
    comments = await deps.issueRepository.fetchAllComments(issue.issueKey)
  } catch (error) {
    deps.logger.warn(
      `課題 ${issue.issueKey} のコメント取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const attachmentLinks = options.downloadAttachments
    ? await downloadIssueAttachments(deps, issue, options)
    : undefined

  const filePath = path.join(options.outputDir, issueRelativePath(issue, options))
  await writeMarkdownFile(filePath, buildIssueMarkdown(issue, comments, backlogIssueUrl, attachmentLinks))
  await appendLog(options.outputDir, `課題「${issue.summary}」を更新しました: ${backlogIssueUrl}`)
}

// 保存できた添付のみリンク化する。個々の失敗は警告に留め、課題本体の保存は続行する
async function downloadIssueAttachments(
  deps: ExportIssuesDeps,
  issue: Issue,
  options: ExportIssuesOptions,
): Promise<Map<number, string>> {
  const links = new Map<number, string>()

  for (const attachment of issue.attachments ?? []) {
    const absolutePath = path.join(options.outputDir, attachmentRelativePath(issue, attachment, options))
    try {
      // 添付IDは不変のため、サイズの一致するファイルが既にあれば再ダウンロードしない
      // （サイズ不一致は過去の中断等による破損とみなして取得し直す）
      // eslint-disable-next-line no-await-in-loop
      if ((await fileSize(absolutePath)) !== attachment.size) {
        // eslint-disable-next-line no-await-in-loop
        const data = await deps.issueRepository.downloadAttachment(issue.issueKey, attachment.id)
        // eslint-disable-next-line no-await-in-loop
        await writeBinaryFile(absolutePath, data)
      }

      links.set(attachment.id, attachmentMarkdownLink(issue, attachment, options))
    } catch (error) {
      deps.logger.warn(
        `課題 ${issue.issueKey} の添付ファイル「${attachment.name}」の取得に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return links
}
