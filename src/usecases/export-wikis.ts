import path from 'node:path'

import {wikiRelativePath} from '../domain/file-naming.js'
import {buildWikiMarkdown} from '../domain/markdown/wiki-markdown.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {fetchWikiDetail, fetchWikis} from '../infrastructure/backlog/wiki-api.js'
import {writeProgress} from '../infrastructure/console/progress.js'
import {writeMarkdownFile} from '../infrastructure/storage/markdown-store.js'
import {appendLog} from '../infrastructure/storage/update-log.js'
import {Logger} from './ports.js'

export interface ExportWikisOptions {
  domain: string
  lastUpdated?: string
  outputDir: string
  projectIdOrKey: string
  /** 指定時は該当Wikiのみを取得する */
  wikiIds?: string[]
}

/**
 * BacklogからWikiを取得し、階層構造を保持してMarkdownファイルとして保存する
 */
export async function exportWikis(client: BacklogHttpClient, logger: Logger, options: ExportWikisOptions): Promise<void> {
  logger.log('Wikiの取得を開始します...')

  logger.log('Wiki一覧を取得しています...')
  const wikis = await fetchWikis(client, options.projectIdOrKey)

  logger.log(`${wikis.length}件のWikiが見つかりました。`)

  // 処理対象のWikiを絞り込む
  let filteredWikis = wikis
  if (options.wikiIds && options.wikiIds.length > 0) {
    // Wiki ID指定時は該当Wikiのみを処理する（前回更新日時による絞り込みは行わない）
    const wikiIdSet = new Set(options.wikiIds.map(String))
    filteredWikis = wikis.filter((wiki) => wikiIdSet.has(String(wiki.id)))
    logger.log(`指定された${filteredWikis.length}件のWikiを処理します。`)
  } else if (options.lastUpdated) {
    // 前回の更新日時より新しいWikiのみをフィルタリング
    const lastUpdatedDate = new Date(options.lastUpdated)
    filteredWikis = wikis.filter((wiki) => new Date(wiki.updated) > lastUpdatedDate)
    logger.log(`前回の更新日時(${options.lastUpdated})以降に更新された${filteredWikis.length}件のWikiを処理します。`)
  }

  if (filteredWikis.length === 0) {
    logger.log('更新が必要なWikiはありません。')
    return
  }

  logger.log('Wiki詳細を取得しています...')

  for (const [index, wiki] of filteredWikis.entries()) {
    try {
      writeProgress(`Wikiを取得中... (${index + 1}/${filteredWikis.length}件)`)

      // eslint-disable-next-line no-await-in-loop
      const wikiDetail = await fetchWikiDetail(client, wiki.id, options.projectIdOrKey)

      const wikiFilePath = path.join(options.outputDir, wikiRelativePath(wiki.name))
      const backlogWikiUrl = `https://${options.domain}/alias/wiki/${wiki.id}`
      const markdownContent = buildWikiMarkdown(wiki.name, backlogWikiUrl, wikiDetail.content || '')

      // eslint-disable-next-line no-await-in-loop
      await writeMarkdownFile(wikiFilePath, markdownContent)

      // eslint-disable-next-line no-await-in-loop
      await appendLog(options.outputDir, `Wiki「${wiki.name}」を更新しました: ${backlogWikiUrl}`)

      writeProgress(`Wikiを保存中... (${index + 1}/${filteredWikis.length}件)`)
    } catch (error) {
      logger.warn(`Wiki ${wiki.name} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  logger.log('\nWikiのダウンロードが完了しました！')
}
