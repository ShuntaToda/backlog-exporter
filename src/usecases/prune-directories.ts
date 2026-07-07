import {FolderType} from '../domain/settings.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {validateAndGetProjectId} from '../infrastructure/backlog/project-api.js'
import {resolveApiKey} from '../infrastructure/env.js'
import {findSettingsDirectories, loadSettings} from '../infrastructure/storage/settings-store.js'
import {Logger} from './ports.js'
import {pruneDocuments, pruneWikis} from './prune-exports.js'

export interface PruneFlags {
  apiKey?: string
  domain?: string
  projectIdOrKey?: string
}

/**
 * ルートディレクトリ配下の設定ファイルを探索し、ドキュメント・Wikiフォルダをpruneする。
 * ファイルを削除する破壊的な操作のため、対象ディレクトリごとに
 * options.confirmDirectory で確認する（falseを返すとそのディレクトリをスキップする）。
 */
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

/**
 * 指定されたディレクトリのpruneを実行する
 */
async function pruneDirectory(
  logger: Logger,
  targetDir: string,
  flags: PruneFlags,
  confirmDirectory: (directory: string) => Promise<boolean>,
): Promise<void> {
  const settings = await loadSettings(targetDir)

  // pruneはドキュメント・Wikiが対象。それ以外（課題など）のフォルダはスキップする
  if (settings.folderType !== FolderType.DOCUMENT && settings.folderType !== FolderType.WIKI) {
    // 古いバージョンで作成された設定ファイルには folderType がないため、無言でスキップせず理由を伝える
    if (!settings.folderType) {
      logger.warn(`${targetDir}: 設定ファイルに folderType がないためスキップします（update コマンドを実行すると保存されます）`)
    }

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

  // 削除を伴うため確認する（--force でスキップ）
  const confirmed = await confirmDirectory(targetDir)
  if (!confirmed) {
    return
  }

  const client = new BacklogHttpClient({
    apiKey,
    domain,
    onRateLimitWait: () => logger.log('レート制限を回避するため15秒間待機します...'),
  })

  await (settings.folderType === FolderType.WIKI
    ? pruneWikis(client, logger, {outputDir: targetDir, projectIdOrKey})
    : validateAndGetProjectId(client, projectIdOrKey).then((projectId) =>
        pruneDocuments(client, logger, {outputDir: targetDir, projectId}),
      ))

  logger.log(`${targetDir} のpruneが完了しました！`)
}
