import path from 'node:path'

import {writeProgress} from '../../../shared/console/progress.js'
import {Logger} from '../../../shared/ports.js'
import {writeMarkdownFile} from '../../../shared/storage/markdown-store.js'
import {appendLog} from '../../../shared/storage/update-log.js'
import {selectWikisToExport} from '../domain/wiki-filter.js'
import {buildWikiMarkdown} from '../domain/wiki-markdown.js'
import {wikiRelativePath, wikiUrl} from '../domain/wiki-path.js'
import {WikiRepository} from '../domain/wiki-repository.js'

export interface ExportWikisDeps {
  logger: Logger
  wikiRepository: WikiRepository
}

export interface ExportWikisOptions {
  domain: string
  lastUpdated?: string
  outputDir: string
  projectIdOrKey: string
  wikiIds?: string[]
}

export async function exportWikis(deps: ExportWikisDeps, options: ExportWikisOptions): Promise<void> {
  const {logger, wikiRepository} = deps
  logger.log('Wikiの取得を開始します...')

  logger.log('Wiki一覧を取得しています...')
  const allWikis = await wikiRepository.fetchWikis(options.projectIdOrKey)
  logger.log(`${allWikis.length}件のWikiが見つかりました。`)

  const {reason, wikis} = selectWikisToExport(allWikis, options)
  if (reason === 'ids') {
    logger.log(`指定された${wikis.length}件のWikiを処理します。`)
  } else if (reason === 'updatedSince') {
    logger.log(`前回の更新日時(${options.lastUpdated})以降に更新された${wikis.length}件のWikiを処理します。`)
  }

  if (wikis.length === 0) {
    logger.log('更新が必要なWikiはありません。')
    return
  }

  logger.log('Wiki詳細を取得しています...')

  /* eslint-disable no-await-in-loop */
  for (const [index, wiki] of wikis.entries()) {
    try {
      writeProgress(`Wikiを取得中... (${index + 1}/${wikis.length}件)`)

      const wikiDetail = await wikiRepository.fetchDetail(wiki.id, options.projectIdOrKey)

      const filePath = path.join(options.outputDir, wikiRelativePath(wiki.name))
      const backlogWikiUrl = wikiUrl(options.domain, wiki.id)

      await writeMarkdownFile(filePath, buildWikiMarkdown(wiki.name, backlogWikiUrl, wikiDetail.content || ''))
      await appendLog(options.outputDir, `Wiki「${wiki.name}」を更新しました: ${backlogWikiUrl}`)

      writeProgress(`Wikiを保存中... (${index + 1}/${wikis.length}件)`)
    } catch (error) {
      logger.warn(`Wiki ${wiki.name} の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /* eslint-enable no-await-in-loop */

  logger.log('\nWikiのダウンロードが完了しました！')
}
