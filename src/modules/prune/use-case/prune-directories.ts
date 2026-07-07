import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {resolveApiKey} from '../../../shared/config/env.js'
import {Logger} from '../../../shared/ports.js'
import {validateAndGetProjectId} from '../../project/repository/project-api.js'
import {findSettingsDirectories, loadSettings} from '../../settings/repository/settings-store.js'
import {classifyPruneTarget} from '../domain/prune-target.js'
import {pruneDocuments, pruneWikis} from './prune-exports.js'

export interface PruneFlags {
  apiKey?: string
  domain?: string
  projectIdOrKey?: string
}

export async function pruneDirectories(
  logger: Logger,
  options: {
    confirmDirectory: (directory: string) => Promise<boolean>
    flags: PruneFlags
    rootDir: string
  },
): Promise<void> {
  const directories = await findSettingsDirectories(options.rootDir, (dir) => {
    logger.warn(`ディレクトリの読み取りに失敗しました: ${dir}`)
  })

  for (const directory of directories) {
    // eslint-disable-next-line no-await-in-loop
    await pruneDirectory(logger, directory, options.flags, options.confirmDirectory)
  }
}

async function pruneDirectory(
  logger: Logger,
  targetDir: string,
  flags: PruneFlags,
  confirmDirectory: (directory: string) => Promise<boolean>,
): Promise<void> {
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

  const client = new BacklogHttpClient({
    apiKey,
    domain,
    onRateLimitWait: () => logger.log('レート制限を回避するため15秒間待機します...'),
  })

  await (target === 'wiki'
    ? pruneWikis(client, logger, {outputDir: targetDir, projectIdOrKey})
    : validateAndGetProjectId(client, projectIdOrKey).then((projectId) =>
        pruneDocuments(client, logger, {outputDir: targetDir, projectId}),
      ))

  logger.log(`${targetDir} のpruneが完了しました！`)
}
