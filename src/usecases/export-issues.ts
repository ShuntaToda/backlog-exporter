import path from 'node:path'

import {issueFileName, issueRelativeDir} from '../domain/file-naming.js'
import {Issue} from '../domain/issue.js'
import {buildIssueMarkdown} from '../domain/markdown/issue-markdown.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {fetchAllComments, fetchIssueByIdOrKey, fetchIssuesPage} from '../infrastructure/backlog/issue-api.js'
import {writeProgress} from '../infrastructure/console/progress.js'
import {writeMarkdownFile} from '../infrastructure/storage/markdown-store.js'
import {appendLog} from '../infrastructure/storage/update-log.js'
import {Logger} from './ports.js'

export interface ExportIssuesOptions {
  /** 一度に取得する課題の最大数（APIの制限により1ページは最大100件） */
  count?: number
  domain: string
  /** 指定時は該当課題のみを取得する */
  issueIdOrKeys?: string[]
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  lastUpdated?: string
  outputDir: string
  projectId: number
  statusId?: string
}

/**
 * Backlogから課題を取得し、作成年ごとのフォルダにMarkdownファイルとして保存する
 */
export async function exportIssues(
  client: BacklogHttpClient,
  logger: Logger,
  options: ExportIssuesOptions,
): Promise<void> {
  logger.log('課題の取得を開始します...')

  // countのデフォルト値を5000に設定（APIの制限により1ページは最大100件）
  const count = options.count ?? 5000
  const pageSize = Math.min(count, 100)

  const allIssues: Issue[] = []

  if (options.issueIdOrKeys && options.issueIdOrKeys.length > 0) {
    // 課題ID・キーを指定して個別に取得
    for (const [index, issueIdOrKey] of options.issueIdOrKeys.entries()) {
      try {
        writeProgress(`課題を取得中... (${index + 1}/${options.issueIdOrKeys.length}件)`)
        // eslint-disable-next-line no-await-in-loop
        allIssues.push(await fetchIssueByIdOrKey(client, issueIdOrKey))
      } catch (error) {
        logger.warn(
          `課題 ${issueIdOrKey} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  } else {
    // 全件をページングで取得
    try {
      for (;;) {
        writeProgress(`課題を取得中... (${allIssues.length}件取得済み)`)
        // eslint-disable-next-line no-await-in-loop
        const issues = await fetchIssuesPage(client, {
          count: pageSize,
          offset: allIssues.length,
          projectId: options.projectId,
          statusId: options.statusId,
        })
        allIssues.push(...issues)

        if (issues.length < pageSize) {
          break
        }
      }
    } catch (error) {
      throw new Error(`課題の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  logger.log(`\n合計 ${allIssues.length}件の課題が見つかりました。`)

  // 前回の更新日時より新しい課題のみをフィルタリング
  let filteredIssues = allIssues
  if (options.lastUpdated) {
    const lastUpdatedDate = new Date(options.lastUpdated)
    filteredIssues = allIssues.filter((issue) => new Date(issue.updated) > lastUpdatedDate)
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

      const backlogIssueUrl = `https://${options.domain}/view/${issue.issueKey}`

      // コメントを取得（失敗しても課題本体は保存する）
      let comments: Awaited<ReturnType<typeof fetchAllComments>> = []
      try {
        // eslint-disable-next-line no-await-in-loop
        comments = await fetchAllComments(client, issue.issueKey)
      } catch (error) {
        logger.warn(
          `課題 ${issue.issueKey} のコメント取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        )
      }

      const relativeDir = issueRelativeDir(issue, options.issueKeyFolder ?? false)
      const fileName = issueFileName(issue, options.issueKeyFileName ?? false)
      const issueFilePath = path.join(options.outputDir, relativeDir, fileName)

      const markdownContent = buildIssueMarkdown(issue, comments, backlogIssueUrl)

      // eslint-disable-next-line no-await-in-loop
      await writeMarkdownFile(issueFilePath, markdownContent)

      // eslint-disable-next-line no-await-in-loop
      await appendLog(options.outputDir, `課題「${issue.summary}」を更新しました: ${backlogIssueUrl}`)
    } catch (error) {
      logger.warn(
        `課題 ${issue.issueKey} の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  logger.log('\n課題のダウンロードが完了しました！')
}
