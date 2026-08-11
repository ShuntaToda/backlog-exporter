import {Logger} from '../../../shared/ports.js'
import {
  addFallbackDocumentPaths,
  collectDocumentTreePaths,
  resolveDocumentLeafPaths,
} from '../../document/domain/document-path.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
import {findDocumentsMissingFromTree} from '../../document/domain/document-tree-gap.js'
import {buildIssueExpectedPaths} from '../../issue/domain/issue-path.js'
import {IssueRepository} from '../../issue/domain/issue-repository.js'
import {Issue} from '../../issue/domain/issue.js'
import {buildWikiExpectedPaths} from '../../wiki/domain/wiki-path.js'
import {WikiRepository} from '../../wiki/domain/wiki-repository.js'
import {pruneLocalMarkdownFiles} from '../repository/prune-walker.js'

export async function pruneDocuments(
  deps: {documentRepository: DocumentRepository; logger: Logger},
  options: {outputDir: string; projectId: number},
): Promise<number> {
  const {documentRepository, logger} = deps
  logger.log('Backlogのドキュメントツリーを取得しています...')
  const documentTree = await documentRepository.fetchTree(options.projectId)

  const expected = collectDocumentTreePaths(documentTree.activeTree.children)

  // 保存時のファイル名は詳細のtitle基準のため、一覧APIでタイトルを解決してから期待パスを確定する。
  // 一覧はツリーに現れないドキュメントを拾う台帳でもあるため、リーフの有無に関わらず取得する
  logger.log('ドキュメント一覧でファイル名を確認しています...')
  let titlesById: Map<string, string>
  try {
    titlesById = await documentRepository.fetchAllTitles(options.projectId)
  } catch (error) {
    // 一覧に欠けが生じると実在ドキュメントを誤削除するため、何も削除せずに中止する
    throw new Error(
      `ドキュメント一覧の取得に失敗しました。誤削除を防ぐため、何も削除せずに中止します: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  resolveDocumentLeafPaths(expected, titlesById)

  // 取得側はツリーに現れないドキュメントを出力ルート直下に保存するため、同じ配置を期待集合に加える
  // （加えないと、補完して取得したファイルをpruneが即座に削除してしまう）
  addFallbackDocumentPaths(expected, findDocumentsMissingFromTree(documentTree, titlesById))

  return pruneLocalMarkdownFiles({
    expected,
    label: 'ドキュメント',
    log: (message) => logger.log(message),
    outputDir: options.outputDir,
  })
}

export async function pruneWikis(
  deps: {logger: Logger; wikiRepository: WikiRepository},
  options: {outputDir: string; projectIdOrKey: string},
): Promise<number> {
  const {logger, wikiRepository} = deps
  logger.log('BacklogのWiki一覧を取得しています...')
  const wikis = await wikiRepository.fetchWikis(options.projectIdOrKey)

  const expected = buildWikiExpectedPaths(wikis.map((wiki) => wiki.name))

  return pruneLocalMarkdownFiles({
    expected,
    label: 'Wiki',
    log: (message) => logger.log(message),
    outputDir: options.outputDir,
  })
}

export async function pruneIssues(
  deps: {issueRepository: IssueRepository; logger: Logger},
  options: {issueKeyFileName?: boolean; issueKeyFolder?: boolean; outputDir: string; projectId: number},
): Promise<number> {
  const {issueRepository, logger} = deps
  logger.log('Backlogの課題一覧を取得しています...')

  // 期待集合が途中で切れると実在課題のファイルを誤削除するため、capを設けず全件を取得し、
  // 取得に失敗した場合は何も削除せずに中止する
  const issues: Issue[] = []
  const pageSize = 100
  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const page = await issueRepository.fetchPage({
        count: pageSize,
        offset: issues.length,
        projectId: options.projectId,
      })
      issues.push(...page)

      if (page.length < pageSize) {
        break
      }
    }
  } catch (error) {
    throw new Error(
      `課題一覧の取得に失敗しました。誤削除を防ぐため、何も削除せずに中止します: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  logger.log(`${issues.length}件の課題が見つかりました。`)

  const expected = buildIssueExpectedPaths(issues, options)

  return pruneLocalMarkdownFiles({
    expected,
    label: '課題',
    log: (message) => logger.log(message),
    outputDir: options.outputDir,
  })
}
