import {buildWikiExpectedPaths, collectDocumentTreePaths, resolveDocumentLeafPaths} from '../domain/file-naming.js'
import {fetchAllDocumentTitles, fetchDocumentTree} from '../infrastructure/backlog/document-api.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {fetchWikis} from '../infrastructure/backlog/wiki-api.js'
import {pruneLocalMarkdownFiles} from '../infrastructure/storage/markdown-store.js'
import {Logger} from './ports.js'

/**
 * Backlog上に存在しないローカルのドキュメントファイルを削除する（prune）
 *
 * Backlogのドキュメントツリーから「あるべきファイル・ディレクトリのパス集合」を構築し、
 * そこに含まれないローカルの .md ファイルと、空になったディレクトリを削除する。
 * Backlog上でドキュメントが削除・移動された場合に、ローカルをBacklogと同じ状態へ揃える用途。
 *
 * 期待ファイルのファイル名は、ダウンロード保存時と完全に同じロジックで構築する。
 * 保存時はドキュメントの title を sanitizeFileName したものをファイル名にするため、
 * ここでもドキュメント一覧APIから title を取得してファイル名を作り、ツリーの name と title の差異による誤削除を防ぐ。
 *
 * @returns 削除したファイル数
 */
export async function pruneDocuments(
  client: BacklogHttpClient,
  logger: Logger,
  options: {outputDir: string; projectId: number},
): Promise<number> {
  logger.log('Backlogのドキュメントツリーを取得しています...')
  const documentTree = await fetchDocumentTree(client, options.projectId)

  // Backlog上に「あるべき」ファイル・ディレクトリの相対パス集合を構築する
  const expected = collectDocumentTreePaths(documentTree.activeTree.children)

  // ドキュメント一覧APIからタイトルをまとめて取得する
  // （ドキュメントごとに詳細APIを叩くと件数分のリクエストが必要になりレートリミットを浪費するため、100件ずつページングする）
  let titlesById = new Map<string, string>()
  if (expected.leafNodes.length > 0) {
    logger.log(`${expected.leafNodes.length}件のドキュメントの正規ファイル名を確認しています...`)
    try {
      titlesById = await fetchAllDocumentTitles(client, options.projectId)
    } catch (error) {
      // 一覧に欠けが生じると、Backlog上に実在するドキュメントのローカルファイルを
      // 誤削除してしまうため、削除を一切行わずにpruneを中止する
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

/**
 * Backlog上に存在しないローカルのWikiファイルを削除する（prune）
 *
 * Backlogのwiki一覧から「あるべきファイル・ディレクトリのパス集合」を構築し、
 * そこに含まれないローカルの .md ファイルと、空になったディレクトリを削除する。
 *
 * Wikiのファイル名は保存時に一覧APIの name を sanitizeWikiFileName したものを使う（"/" はディレクトリ区切りとして残す）。
 * ドキュメントと異なり name と保存名の差異が生じないため、追加のAPI呼び出しは不要。
 *
 * @returns 削除したファイル数
 */
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
