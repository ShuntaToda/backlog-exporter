export enum FolderType {
  DOCUMENT = 'document',
  ISSUE = 'issue',
  WIKI = 'wiki',
}

export interface Settings {
  apiKey?: string
  domain?: string
  downloadAttachments?: boolean
  folderType?: FolderType
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  lastUpdated?: string
  outputDir?: string
  projectIdOrKey?: string
}
