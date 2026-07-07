import {FolderType} from '../domain/settings.js'
import {BacklogHttpClient} from '../infrastructure/backlog/http-client.js'
import {validateAndGetProjectId} from '../infrastructure/backlog/project-api.js'
import {readYesNo} from '../infrastructure/console/prompt.js'
import {resolveApiKey} from '../infrastructure/env.js'
import {ensureDirectory} from '../infrastructure/storage/markdown-store.js'
import {findSettingsDirectories, loadSettings, updateSettings} from '../infrastructure/storage/settings-store.js'
import {exportDocuments} from './export-documents.js'
import {exportIssues} from './export-issues.js'
import {exportWikis} from './export-wikis.js'
import {Logger} from './ports.js'

export interface UpdateFlags {
  apiKey?: string
  documentId?: string
  documentsOnly?: boolean
  domain?: string
  force?: boolean
  issueIdOrKey?: string
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  issuesOnly?: boolean
  projectIdOrKey?: string
  wikiId?: string
  wikisOnly?: boolean
}

/**
 * カンマ区切りのID指定をパースする（指定時は該当項目のみを再取得する）
 */
function parseIds(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

/**
 * フォルダタイプとonly系フラグから更新対象を決定する
 */
export function determineUpdateTargets(
  folderType: FolderType | undefined,
  documentsOnly: boolean | undefined,
  issuesOnly: boolean | undefined,
  wikisOnly: boolean | undefined,
): {
  updateDocuments: boolean
  updateIssues: boolean
  updateWikis: boolean
} {
  let updateIssues = !wikisOnly && !documentsOnly
  let updateWikis = !issuesOnly && !documentsOnly
  let updateDocuments = !issuesOnly && !wikisOnly

  // フォルダタイプに応じて更新対象を決定
  switch (folderType) {
    case FolderType.DOCUMENT: {
      updateIssues = false
      updateWikis = false
      updateDocuments = true
      break
    }

    case FolderType.ISSUE: {
      updateIssues = true
      updateWikis = false
      updateDocuments = false
      break
    }

    case FolderType.WIKI: {
      updateIssues = false
      updateWikis = true
      updateDocuments = false
      break
    }
  }

  return {updateDocuments, updateIssues, updateWikis}
}

/**
 * ルートディレクトリ配下の設定ファイルを探索し、見つかった各ディレクトリを差分更新する
 */
export async function updateExports(logger: Logger, rootDir: string, flags: UpdateFlags): Promise<void> {
  const directories = await findSettingsDirectories(rootDir, (dir) => {
    logger.warn(`ディレクトリの読み取りに失敗しました: ${dir}`)
  })

  for (const directory of directories) {
    // eslint-disable-next-line no-await-in-loop
    await updateDirectory(logger, directory, flags)
  }
}

/**
 * 更新に必要な設定値の解決結果
 */
interface UpdateContext {
  apiKey: string
  documentIds?: string[]
  domain: string
  folderType?: FolderType
  issueIdOrKeys?: string[]
  issueKeyFileName: boolean
  issueKeyFolder: boolean
  lastUpdated?: string
  projectIdOrKey: string
  updateDocuments: boolean
  updateIssues: boolean
  updateWikis: boolean
  wikiIds?: string[]
}

/**
 * コマンドライン引数と設定ファイルを組み合わせて更新に必要な値を解決する。
 * 必須パラメータが欠けている場合は警告を出して undefined を返す（そのディレクトリはスキップ）。
 */
async function resolveUpdateContext(
  logger: Logger,
  targetDir: string,
  flags: UpdateFlags,
): Promise<undefined | UpdateContext> {
  const settings = await loadSettings(targetDir)

  const domain = flags.domain || settings.domain
  const projectIdOrKey = flags.projectIdOrKey || settings.projectIdOrKey
  const {folderType, lastUpdated} = settings

  if (!domain) {
    logger.warn(`${targetDir}: ドメインが指定されていません。スキップします。`)
    return undefined
  }

  if (!projectIdOrKey) {
    logger.warn(`${targetDir}: プロジェクトIDまたはキーが指定されていません。スキップします。`)
    return undefined
  }

  const apiKey =
    flags.apiKey ||
    settings.apiKey ||
    resolveApiKey(undefined, () => logger.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します'))
  if (!apiKey) {
    logger.warn(
      `${targetDir}: APIキーが指定されていません。--apiKey フラグまたは BACKLOG_API_KEY 環境変数で設定してください。`,
    )
    return undefined
  }

  const issueIdOrKeys = parseIds(flags.issueIdOrKey)
  const wikiIds = parseIds(flags.wikiId)
  const documentIds = parseIds(flags.documentId)

  // 更新対象の決定
  const targets = determineUpdateTargets(folderType, flags.documentsOnly, flags.issuesOnly, flags.wikisOnly)

  // いずれかのID指定がある場合は「指定した項目のみ再取得」モードとし、
  // ID指定のない種別は更新対象から外す（例: --wikiId のみ指定時は課題・ドキュメントを更新しない）
  const hasTargetedFetch = Boolean(issueIdOrKeys || wikiIds || documentIds)
  if (hasTargetedFetch) {
    if (!issueIdOrKeys) targets.updateIssues = false
    if (!wikiIds) targets.updateWikis = false
    if (!documentIds) targets.updateDocuments = false
  }

  return {
    apiKey,
    documentIds,
    domain,
    folderType,
    issueIdOrKeys,
    // 設定ファイルからオプションを読み込み、コマンドライン引数で上書き
    issueKeyFileName: flags.issueKeyFileName ?? settings.issueKeyFileName ?? false,
    issueKeyFolder: flags.issueKeyFolder ?? settings.issueKeyFolder ?? false,
    lastUpdated,
    projectIdOrKey,
    wikiIds,
    ...targets,
  }
}

/**
 * 全件差分更新の完了後に設定ファイルへ最終更新日時を記録する
 */
async function saveFullUpdateResult(targetDir: string, context: UpdateContext, folderType: FolderType): Promise<void> {
  await updateSettings(targetDir, {
    apiKey: context.apiKey,
    domain: context.domain,
    folderType,
    lastUpdated: new Date().toISOString(),
    outputDir: targetDir,
    projectIdOrKey: context.projectIdOrKey,
  })
}

/**
 * 指定されたディレクトリの更新を実行する
 */
async function updateDirectory(logger: Logger, targetDir: string, flags: UpdateFlags): Promise<void> {
  const context = await resolveUpdateContext(logger, targetDir, flags)
  if (!context) return

  // 更新前の確認
  const confirmed = await confirmUpdate(logger, {
    domain: context.domain,
    folderType: context.folderType,
    force: flags.force || false,
    projectIdOrKey: context.projectIdOrKey,
    targetDir,
    updateDocuments: context.updateDocuments,
    updateIssues: context.updateIssues,
    updateWikis: context.updateWikis,
  })
  if (!confirmed) return

  await ensureDirectory(targetDir)

  const client = new BacklogHttpClient({
    apiKey: context.apiKey,
    domain: context.domain,
    onRateLimitWait: () => logger.log('レート制限を回避するため15秒間待機します...'),
  })

  // プロジェクトキーからプロジェクトIDを取得
  const projectId = await validateAndGetProjectId(client, context.projectIdOrKey)
  logger.log(`プロジェクトID: ${projectId} を使用します`)

  if (context.updateIssues) {
    logger.log('課題の更新を開始します...')
    await exportIssues(client, logger, {
      count: 100,
      domain: context.domain,
      issueIdOrKeys: context.issueIdOrKeys,
      issueKeyFileName: context.issueKeyFileName,
      issueKeyFolder: context.issueKeyFolder,
      // ID指定時は全件差分更新ではなく該当項目のみを取得するため、lastUpdatedによる絞り込みは行わない
      lastUpdated: context.issueIdOrKeys ? undefined : context.lastUpdated,
      outputDir: targetDir,
      projectId,
    })

    // ID指定時は全件取得ではないため、最終更新日時（lastUpdated）は更新しない
    // （次回の全件差分更新に影響を与えないようにするため）
    if (!context.issueIdOrKeys) {
      await saveFullUpdateResult(targetDir, context, FolderType.ISSUE)
    }

    logger.log('課題の更新が完了しました')
  }

  if (context.updateWikis) {
    logger.log('Wikiの更新を開始します...')
    await exportWikis(client, logger, {
      domain: context.domain,
      lastUpdated: context.wikiIds ? undefined : context.lastUpdated,
      outputDir: targetDir,
      projectIdOrKey: context.projectIdOrKey,
      wikiIds: context.wikiIds,
    })

    if (!context.wikiIds) {
      await saveFullUpdateResult(targetDir, context, FolderType.WIKI)
    }

    logger.log('Wikiの更新が完了しました')
  }

  if (context.updateDocuments) {
    logger.log('ドキュメントの更新を開始します...')
    await exportDocuments(client, logger, {
      documentIds: context.documentIds,
      domain: context.domain,
      lastUpdated: context.documentIds ? undefined : context.lastUpdated,
      outputDir: targetDir,
      projectId,
      projectIdOrKey: context.projectIdOrKey,
    })

    if (!context.documentIds) {
      await saveFullUpdateResult(targetDir, context, FolderType.DOCUMENT)
    }

    logger.log('ドキュメントの更新が完了しました')
  }

  logger.log(`${targetDir} の更新が完了しました！`)
}

/**
 * 更新前の確認プロンプトを表示する
 */
async function confirmUpdate(
  logger: Logger,
  options: {
    domain: string
    folderType?: FolderType
    force: boolean
    projectIdOrKey: string
    targetDir: string
    updateDocuments: boolean
    updateIssues: boolean
    updateWikis: boolean
  },
): Promise<boolean> {
  if (options.force) return true

  logger.log(`以下の設定で更新を実行します:`)
  logger.log(`- ディレクトリ: ${options.targetDir}`)
  logger.log(`- ドメイン: ${options.domain}`)
  logger.log(`- プロジェクト: ${options.projectIdOrKey}`)

  if (options.folderType) {
    logger.log(`- フォルダタイプ: ${options.folderType}`)
  }

  const updateTargets = []
  if (options.updateIssues) updateTargets.push('課題')
  if (options.updateWikis) updateTargets.push('Wiki')
  if (options.updateDocuments) updateTargets.push('ドキュメント')

  logger.log(`- 更新対象: ${updateTargets.join('・')}`)

  logger.log('更新を実行しますか？ (y/n)')
  const response = await readYesNo()

  if (!response) {
    logger.log('更新をキャンセルしました')
  }

  return response
}
