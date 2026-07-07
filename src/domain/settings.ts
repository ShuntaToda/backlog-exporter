/**
 * エクスポートフォルダの種別
 */
export enum FolderType {
  DOCUMENT = 'document',
  ISSUE = 'issue',
  WIKI = 'wiki',
}

/**
 * 各エクスポートディレクトリの backlog-settings.json に保存される設定
 */
export interface Settings {
  apiKey?: string
  domain?: string
  folderType?: FolderType
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  lastUpdated?: string
  outputDir?: string
  projectIdOrKey?: string
}
