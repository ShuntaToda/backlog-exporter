import {BacklogAuth} from '../../../shared/backlog/auth.js'
import {Logger} from '../../../shared/ports.js'
import {assertDirectoryExists} from '../../../shared/storage/markdown-store.js'
import {AUTH_NOT_FOUND_MESSAGE} from '../../auth/use-case/resolve-backlog-auth.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
import {IssueRepository} from '../../issue/domain/issue-repository.js'
import {ProjectRepository} from '../../project/domain/project-repository.js'
import {findSettingsDirectories, loadSettings} from '../../settings/repository/settings-store.js'
import {WikiRepository} from '../../wiki/domain/wiki-repository.js'
import {classifyPruneTarget} from '../domain/prune-target.js'
import {pruneDocuments, pruneIssues, pruneWikis} from './prune-exports.js'

export interface PruneFlags {
  apiKey?: string
  domain?: string
  projectIdOrKey?: string
}

export interface PruneDeps {
  // ディレクトリごとに設定ファイルから接続情報が決まるため、repositoryはファクトリで注入する
  createRepositories: (connection: {
    auth: BacklogAuth
    domain: string
    onRateLimitExceeded?: (waitSeconds: number) => void
  }) => {
    documentRepository: DocumentRepository
    issueRepository: IssueRepository
    projectRepository: ProjectRepository
    wikiRepository: WikiRepository
  }
  logger: Logger
  // スペースごとにOAuthのログイン情報が分かれるため、ディレクトリのドメインが決まってから解決する
  resolveAuth: (input: {apiKey?: string; domain: string}) => Promise<BacklogAuth | undefined>
}

export async function pruneDirectories(
  deps: PruneDeps,
  options: {
    confirmDirectory: (directory: string) => Promise<boolean>
    flags: PruneFlags
    rootDir: string
  },
): Promise<void> {
  const {logger} = deps

  await assertDirectoryExists(options.rootDir)

  const directories = await findSettingsDirectories(options.rootDir, (dir) => {
    logger.warn(`ディレクトリの読み取りに失敗しました: ${dir}`)
  })

  if (directories.length === 0) {
    logger.warn(`設定ファイル（backlog-settings.json）が見つかりませんでした: ${options.rootDir}`)
    return
  }

  for (const directory of directories) {
    // eslint-disable-next-line no-await-in-loop
    await pruneDirectory(deps, directory, options.flags, options.confirmDirectory)
  }
}

async function pruneDirectory(
  deps: PruneDeps,
  targetDir: string,
  flags: PruneFlags,
  confirmDirectory: (directory: string) => Promise<boolean>,
): Promise<void> {
  const {logger} = deps
  const settings = await loadSettings(targetDir)

  const target = classifyPruneTarget(settings)
  if (target === 'missing-folder-type') {
    logger.warn(
      `${targetDir}: 設定ファイルに folderType がないためスキップします（update コマンドを実行すると保存されます）`,
    )
    return
  }

  if (target === 'not-target') {
    return
  }

  const domain = flags.domain || settings.domain
  const projectIdOrKey = flags.projectIdOrKey || settings.projectIdOrKey

  if (!domain) {
    logger.warn(`${targetDir}: ドメインが指定されていません。スキップします。`)
    return
  }

  if (!projectIdOrKey) {
    logger.warn(`${targetDir}: プロジェクトID/キーが指定されていません。スキップします。`)
    return
  }

  const auth = await deps.resolveAuth({apiKey: flags.apiKey || settings.apiKey, domain})
  if (!auth) {
    logger.warn(`${targetDir}: 認証情報が見つかりません。スキップします。${AUTH_NOT_FOUND_MESSAGE}`)
    return
  }

  const confirmed = await confirmDirectory(targetDir)
  if (!confirmed) {
    return
  }

  const {documentRepository, issueRepository, projectRepository, wikiRepository} = deps.createRepositories({
    auth,
    domain,
    onRateLimitExceeded: (waitSeconds: number) =>
      logger.log(`レート制限の上限に達しました。${waitSeconds}秒待機します...`),
  })

  if (target === 'wiki') {
    await pruneWikis({logger, wikiRepository}, {outputDir: targetDir, projectIdOrKey})
  } else {
    const projectId = await projectRepository.resolveProjectId(projectIdOrKey)
    await (target === 'issue'
      ? pruneIssues(
          {issueRepository, logger},
          {
            // 保存時の命名を再現するため、エクスポート時に保存された設定を使う
            issueKeyFileName: settings.issueKeyFileName,
            issueKeyFolder: settings.issueKeyFolder,
            outputDir: targetDir,
            projectId,
          },
        )
      : pruneDocuments({documentRepository, logger}, {outputDir: targetDir, projectId}))
  }

  logger.log(`${targetDir} のpruneが完了しました！`)
}
