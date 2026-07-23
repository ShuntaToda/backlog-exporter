import {FolderType, Settings} from '../../settings/domain/settings.js'

export interface UpdateFlags {
  apiKey?: string
  documentId?: string
  documentsOnly?: boolean
  domain?: string
  downloadAttachments?: boolean
  force?: boolean
  issueIdOrKey?: string
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  issuesOnly?: boolean
  projectIdOrKey?: string
  wikiId?: string
  wikisOnly?: boolean
}

export interface UpdatePlan {
  documentIds?: string[]
  domain?: string
  downloadAttachments: boolean
  folderType?: FolderType
  issueIdOrKeys?: string[]
  issueKeyFileName: boolean
  issueKeyFolder: boolean
  lastUpdated?: string
  projectIdOrKey?: string
  updateDocuments: boolean
  updateIssues: boolean
  updateWikis: boolean
  wikiIds?: string[]
}

export function parseIds(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

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

export function buildUpdatePlan(settings: Settings, flags: UpdateFlags): UpdatePlan {
  const issueIdOrKeys = parseIds(flags.issueIdOrKey)
  const wikiIds = parseIds(flags.wikiId)
  const documentIds = parseIds(flags.documentId)

  // 更新対象の決定
  const targets = determineUpdateTargets(settings.folderType, flags.documentsOnly, flags.issuesOnly, flags.wikisOnly)

  // いずれかのID指定がある場合は「指定した項目のみ再取得」モードとし、
  // ID指定のない種別は更新対象から外す（例: --wikiId のみ指定時は課題・ドキュメントを更新しない）
  const hasTargetedFetch = Boolean(issueIdOrKeys || wikiIds || documentIds)
  if (hasTargetedFetch) {
    if (!issueIdOrKeys) targets.updateIssues = false
    if (!wikiIds) targets.updateWikis = false
    if (!documentIds) targets.updateDocuments = false
  }

  return {
    documentIds,
    // コマンドライン引数と設定ファイルを組み合わせて使用する値を決定
    domain: flags.domain || settings.domain,
    downloadAttachments: flags.downloadAttachments ?? settings.downloadAttachments ?? false,
    folderType: settings.folderType,
    issueIdOrKeys,
    // 設定ファイルからオプションを読み込み、コマンドライン引数で上書き
    issueKeyFileName: flags.issueKeyFileName ?? settings.issueKeyFileName ?? false,
    issueKeyFolder: flags.issueKeyFolder ?? settings.issueKeyFolder ?? false,
    lastUpdated: settings.lastUpdated,
    projectIdOrKey: flags.projectIdOrKey || settings.projectIdOrKey,
    wikiIds,
    ...targets,
  }
}
