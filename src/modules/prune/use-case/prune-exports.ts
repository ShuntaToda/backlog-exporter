import {Logger} from '../../../shared/ports.js'
import {collectDocumentTreePaths, resolveDocumentLeafPaths} from '../../document/domain/document-path.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
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

  // 保存時のファイル名は詳細のtitle基準のため、一覧APIでタイトルを解決してから期待パスを確定する
  let titlesById = new Map<string, string>()
  if (expected.leafNodes.length > 0) {
    logger.log(`${expected.leafNodes.length}件のドキュメントの正規ファイル名を確認しています...`)
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
