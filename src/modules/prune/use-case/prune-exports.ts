import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {Logger} from '../../../shared/ports.js'
import {collectDocumentTreePaths, resolveDocumentLeafPaths} from '../../document/domain/document-path.js'
import {fetchAllDocumentTitles, fetchDocumentTree} from '../../document/repository/document-api.js'
import {buildWikiExpectedPaths} from '../../wiki/domain/wiki-path.js'
import {fetchWikis} from '../../wiki/repository/wiki-api.js'
import {pruneLocalMarkdownFiles} from '../repository/prune-walker.js'

export async function pruneDocuments(
  client: BacklogHttpClient,
  logger: Logger,
  options: {outputDir: string; projectId: number},
): Promise<number> {
  logger.log('Backlogのドキュメントツリーを取得しています...')
  const documentTree = await fetchDocumentTree(client, options.projectId)

  const expected = collectDocumentTreePaths(documentTree.activeTree.children)

  // 保存時のファイル名は詳細のtitle基準のため、一覧APIでタイトルを解決してから期待パスを確定する
  let titlesById = new Map<string, string>()
  if (expected.leafNodes.length > 0) {
    logger.log(`${expected.leafNodes.length}件のドキュメントの正規ファイル名を確認しています...`)
    try {
      titlesById = await fetchAllDocumentTitles(client, options.projectId)
    } catch (error) {
      // 一覧に欠けが生じると実在ドキュメントを誤削除するため、何も削除せずに中止する
      throw new Error(
        `ドキュメント一覧の取得に失敗しました。誤削除を防ぐため、何も削除せずに中止します: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  resolveDocumentLeafPaths(expected, titlesById)

  return pruneLocalMarkdownFiles({
    expected,
    label: 'ドキュメント',
    log: (message) => logger.log(message),
    outputDir: options.outputDir,
  })
}

export async function pruneWikis(
  client: BacklogHttpClient,
  logger: Logger,
  options: {outputDir: string; projectIdOrKey: string},
): Promise<number> {
  logger.log('BacklogのWiki一覧を取得しています...')
  const wikis = await fetchWikis(client, options.projectIdOrKey)

  const expected = buildWikiExpectedPaths(wikis.map((wiki) => wiki.name))

  return pruneLocalMarkdownFiles({
    expected,
    label: 'Wiki',
    log: (message) => logger.log(message),
    outputDir: options.outputDir,
  })
}
