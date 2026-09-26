import path from 'node:path'

import {writeProgress} from '../../../shared/console/progress.js'
import {Logger} from '../../../shared/ports.js'
import {fileSize, writeBinaryFile, writeMarkdownFile} from '../../../shared/storage/markdown-store.js'
import {appendLog} from '../../../shared/storage/update-log.js'
import {filterIssuesUpdatedSince} from '../domain/issue-filter.js'
import {buildIssueMarkdown} from '../domain/issue-markdown.js'
import {attachmentMarkdownLink, attachmentRelativePath, issueRelativePath, issueUrl} from '../domain/issue-path.js'
import {buildChildIndex, buildIssueRefIndex, findChildren, findParent, IssueRef} from '../domain/issue-relations.js'
import {IssueRepository} from '../domain/issue-repository.js'
import {Issue, IssueComment} from '../domain/issue.js'

// 親子の解決に使う課題の索引。保存ループに入る前に一度だけ組み立てる
interface RelationIndex {
  childIndex: Map<number, IssueRef[]>
  refIndex: Map<number, IssueRef>
}

// Backlogの配列パラメータの上限に合わせ、一括取得は100件ずつに分ける
const BULK_FETCH_SIZE = 100

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

  const relationIndex = await buildRelationIndex(deps, allIssues, filteredIssues, options)

  for (const [index, issue] of filteredIssues.entries()) {
    try {
      writeProgress(`課題を保存中... (${index + 1}/${filteredIssues.length}件)`)
      // eslint-disable-next-line no-await-in-loop
      await saveIssue(deps, issue, options, relationIndex)
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

async function saveIssue(
  deps: ExportIssuesDeps,
  issue: Issue,
  options: ExportIssuesOptions,
  relationIndex: RelationIndex,
): Promise<void> {
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

  const attachmentLinks = options.downloadAttachments ? await downloadIssueAttachments(deps, issue, options) : undefined

  const filePath = path.join(options.outputDir, issueRelativePath(issue, options))
  await writeMarkdownFile(
    filePath,
    buildIssueMarkdown(issue, comments, backlogIssueUrl, {
      attachmentLinks,
      issueUrl: (issueKey) => issueUrl(options.domain, issueKey),
      relations: {
        children: findChildren(issue, relationIndex.childIndex),
        parent: findParent(issue, relationIndex.refIndex),
      },
    }),
  )
  await appendLog(options.outputDir, `課題「${issue.summary}」を更新しました: ${backlogIssueUrl}`)
}

// 取得済みの課題だけでは足りない親子をAPIで補い、索引を組み立てる。
// 課題ごとに引くとN+1になるため、いずれも配列パラメータでまとめて取得する。
// 補完に失敗しても課題本体の保存は続行する（関連情報が欠けるだけに留める）
async function buildRelationIndex(
  deps: ExportIssuesDeps,
  allIssues: Issue[],
  targets: Issue[],
  options: ExportIssuesOptions,
): Promise<RelationIndex> {
  const sources = [...allIssues]

  // 課題キー指定では取得済み集合に子が含まれないため、対象課題の子をまとめて引く
  if (options.issueIdOrKeys && options.issueIdOrKeys.length > 0) {
    sources.push(...(await fetchChildrenOf(deps, targets)))
  }

  sources.push(...(await fetchMissingParents(deps, targets, buildIssueRefIndex(sources))))

  return {childIndex: buildChildIndex(sources), refIndex: buildIssueRefIndex(sources)}
}

async function fetchChildrenOf(deps: ExportIssuesDeps, targets: Issue[]): Promise<Issue[]> {
  const children: Issue[] = []

  for (const ids of chunkIds(targets.map((target) => target.id))) {
    try {
      // eslint-disable-next-line no-await-in-loop
      children.push(...(await deps.issueRepository.fetchChildren(ids)))
    } catch (error) {
      deps.logger.warn(`子課題の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return children
}

// 別プロジェクトの親やstatusIdで絞り込まれた親は取得済み集合に現れないため、IDから引き直す
async function fetchMissingParents(
  deps: ExportIssuesDeps,
  targets: Issue[],
  refIndex: Map<number, IssueRef>,
): Promise<Issue[]> {
  const missingIds = [
    ...new Set(
      targets
        .map((target) => target.parentIssueId)
        .filter((parentIssueId): parentIssueId is number => typeof parentIssueId === 'number')
        .filter((parentIssueId) => !refIndex.has(parentIssueId)),
    ),
  ]

  const parents: Issue[] = []
  for (const ids of chunkIds(missingIds)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      parents.push(...(await deps.issueRepository.fetchByIds(ids)))
    } catch (error) {
      deps.logger.warn(`親課題の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return parents
}

function chunkIds(ids: number[]): number[][] {
  const chunks: number[][] = []
  for (let index = 0; index < ids.length; index += BULK_FETCH_SIZE) {
    chunks.push(ids.slice(index, index + BULK_FETCH_SIZE))
  }

  return chunks
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
