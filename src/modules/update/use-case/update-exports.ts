import {resolveApiKey} from '../../../shared/config/env.js'
import {readYesNo} from '../../../shared/console/prompt.js'
import {Logger} from '../../../shared/ports.js'
import {assertDirectoryExists, ensureDirectory} from '../../../shared/storage/markdown-store.js'
import {DocumentRepository} from '../../document/domain/document-repository.js'
import {exportDocuments} from '../../document/use-case/export-documents.js'
import {IssueRepository} from '../../issue/domain/issue-repository.js'
import {exportIssues} from '../../issue/use-case/export-issues.js'
import {ProjectRepository} from '../../project/domain/project-repository.js'
import {FolderType} from '../../settings/domain/settings.js'
import {findSettingsDirectories, loadSettings, updateSettings} from '../../settings/repository/settings-store.js'
import {WikiRepository} from '../../wiki/domain/wiki-repository.js'
import {exportWikis} from '../../wiki/use-case/export-wikis.js'
import {buildUpdatePlan, UpdateFlags, UpdatePlan} from '../domain/update-plan.js'

export type {UpdateFlags} from '../domain/update-plan.js'

export interface UpdateDeps {
  // ディレクトリごとに設定ファイルから接続情報が決まるため、repositoryはファクトリで注入する
  createRepositories: (connection: {
    apiKey: string
    domain: string
    onRateLimitExceeded?: (waitSeconds: number) => void
    onRateLimitWait?: () => void
  }) => {
    documentRepository: DocumentRepository
    issueRepository: IssueRepository
    projectRepository: ProjectRepository
    wikiRepository: WikiRepository
  }
  logger: Logger
}

export async function updateExports(deps: UpdateDeps, rootDir: string, flags: UpdateFlags): Promise<void> {
  const {logger} = deps

  await assertDirectoryExists(rootDir)

  const directories = await findSettingsDirectories(rootDir, (dir) => {
    logger.warn(`ディレクトリの読み取りに失敗しました: ${dir}`)
  })

  if (directories.length === 0) {
    logger.warn(`設定ファイル（backlog-settings.json）が見つかりませんでした: ${rootDir}`)
    return
  }

  for (const directory of directories) {
    // eslint-disable-next-line no-await-in-loop
    await updateDirectory(deps, directory, flags)
  }
}

async function updateDirectory(deps: UpdateDeps, targetDir: string, flags: UpdateFlags): Promise<void> {
  const {logger} = deps
  const settings = await loadSettings(targetDir)
  const plan = buildUpdatePlan(settings, flags)

  if (!plan.domain) {
    logger.warn(`${targetDir}: ドメインが指定されていません。スキップします。`)
    return
  }

  if (!plan.projectIdOrKey) {
    logger.warn(`${targetDir}: プロジェクトIDまたはキーが指定されていません。スキップします。`)
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

  const confirmed = await confirmUpdate(logger, targetDir, plan, flags.force || false)
  if (!confirmed) return

  await ensureDirectory(targetDir)

  const {documentRepository, issueRepository, projectRepository, wikiRepository} = deps.createRepositories({
    apiKey,
    domain: plan.domain,
    onRateLimitExceeded: (waitSeconds: number) => logger.log(`レート制限の上限に達しました。${waitSeconds}秒待機します...`),
    onRateLimitWait: () => logger.log('レート制限を回避するため15秒間待機します...'),
  })

  const projectId = await projectRepository.resolveProjectId(plan.projectIdOrKey)
  logger.log(`プロジェクトID: ${projectId} を使用します`)

  const saveFullUpdateResult = (folderType: FolderType) =>
    updateSettings(targetDir, {
      apiKey,
      domain: plan.domain,
      folderType,
      lastUpdated: new Date().toISOString(),
      outputDir: targetDir,
      projectIdOrKey: plan.projectIdOrKey,
    })

  if (plan.updateIssues) {
    logger.log('課題の更新を開始します...')
    await exportIssues(
      {issueRepository, logger},
      {
        count: 100,
        domain: plan.domain,
        downloadAttachments: plan.downloadAttachments,
        issueIdOrKeys: plan.issueIdOrKeys,
        issueKeyFileName: plan.issueKeyFileName,
        issueKeyFolder: plan.issueKeyFolder,
        // ID指定時は該当項目のみを取得するため、lastUpdatedによる絞り込みと最終更新日時の記録は行わない
        lastUpdated: plan.issueIdOrKeys ? undefined : plan.lastUpdated,
        outputDir: targetDir,
        projectId,
      },
    )

    if (!plan.issueIdOrKeys) {
      await saveFullUpdateResult(FolderType.ISSUE)
    }

    logger.log('課題の更新が完了しました')
  }

  if (plan.updateWikis) {
    logger.log('Wikiの更新を開始します...')
    await exportWikis(
      {logger, wikiRepository},
      {
        domain: plan.domain,
        lastUpdated: plan.wikiIds ? undefined : plan.lastUpdated,
        outputDir: targetDir,
        projectIdOrKey: plan.projectIdOrKey,
        wikiIds: plan.wikiIds,
      },
    )

    if (!plan.wikiIds) {
      await saveFullUpdateResult(FolderType.WIKI)
    }

    logger.log('Wikiの更新が完了しました')
  }

  if (plan.updateDocuments) {
    logger.log('ドキュメントの更新を開始します...')
    await exportDocuments(
      {documentRepository, logger},
      {
        documentIds: plan.documentIds,
        domain: plan.domain,
        lastUpdated: plan.documentIds ? undefined : plan.lastUpdated,
        outputDir: targetDir,
        projectId,
        projectIdOrKey: plan.projectIdOrKey,
      },
    )

    if (!plan.documentIds) {
      await saveFullUpdateResult(FolderType.DOCUMENT)
    }

    logger.log('ドキュメントの更新が完了しました')
  }

  logger.log(`${targetDir} の更新が完了しました！`)
}

async function confirmUpdate(logger: Logger, targetDir: string, plan: UpdatePlan, force: boolean): Promise<boolean> {
  if (force) return true

  logger.log(`以下の設定で更新を実行します:`)
  logger.log(`- ディレクトリ: ${targetDir}`)
  logger.log(`- ドメイン: ${plan.domain}`)
  logger.log(`- プロジェクト: ${plan.projectIdOrKey}`)

  if (plan.folderType) {
    logger.log(`- フォルダタイプ: ${plan.folderType}`)
  }

  const updateTargets = []
  if (plan.updateIssues) updateTargets.push('課題')
  if (plan.updateWikis) updateTargets.push('Wiki')
  if (plan.updateDocuments) updateTargets.push('ドキュメント')

  logger.log(`- 更新対象: ${updateTargets.join('・')}`)

  logger.log('更新を実行しますか？ (y/n)')
  const response = await readYesNo()

  if (!response) {
    logger.log('更新をキャンセルしました')
  }

  return response
}
