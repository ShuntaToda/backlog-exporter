import {resolveApiKey} from '../../../shared/config/env.js'
import {Logger} from '../../../shared/ports.js'
import {assertDirectoryExists} from '../../../shared/storage/markdown-store.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
import {ProjectRepository} from '../../project/domain/project-repository.js'
import {findSettingsDirectories, loadSettings} from '../../settings/repository/settings-store.js'
import {WikiRepository} from '../../wiki/domain/wiki-repository.js'
import {classifyPruneTarget} from '../domain/prune-target.js'
import {pruneDocuments, pruneWikis} from './prune-exports.js'

export interface PruneFlags {
  apiKey?: string
  domain?: string
  projectIdOrKey?: string
}

export interface PruneDeps {
  // ディレクトリごとに設定ファイルから接続情報が決まるため、repositoryはファクトリで注入する
  createRepositories: (connection: {apiKey: string; domain: string; onRateLimitWait?: () => void}) => {
    documentRepository: DocumentRepository
    projectRepository: ProjectRepository
    wikiRepository: WikiRepository
  }
  logger: Logger
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

  const apiKey =
    flags.apiKey ||
    settings.apiKey ||
    resolveApiKey(undefined, () => logger.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します'))
  if (!apiKey) {
    logger.warn(
      `${targetDir}: APIキーが指定されていません。--apiKey フラグまたは BACKLOG_API_KEY 環境変数で設定してください。`,
    )
    return
  }

  const confirmed = await confirmDirectory(targetDir)
  if (!confirmed) {
    return
  }

  const {documentRepository, projectRepository, wikiRepository} = deps.createRepositories({
    apiKey,
    domain,
    onRateLimitWait: () => logger.log('レート制限を回避するため15秒間待機します...'),
  })

  await (target === 'wiki'
    ? pruneWikis({logger, wikiRepository}, {outputDir: targetDir, projectIdOrKey})
    : projectRepository
        .resolveProjectId(projectIdOrKey)
        .then((projectId) => pruneDocuments({documentRepository, logger}, {outputDir: targetDir, projectId})))

  logger.log(`${targetDir} のpruneが完了しました！`)
}
