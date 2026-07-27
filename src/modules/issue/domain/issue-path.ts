import path from 'node:path'

import {attachmentFileName, encodeLinkDestination} from '../../../shared/attachment.js'
import {backlogOrigin} from '../../../shared/backlog-url.js'
import {sanitizeFileName} from '../../../shared/file-name.js'
import {ExpectedPaths} from '../../prune/domain/expected-paths.js'
import {Issue, IssueAttachment} from './issue.js'

export function issueFileName(issue: {issueKey: string; summary: string}, useIssueKey: boolean): string {
  return useIssueKey ? `${issue.issueKey}.md` : `${sanitizeFileName(issue.summary)}.md`
}

export function issueRelativeDir(issue: {created: string; issueKey: string}, useIssueKeyFolder: boolean): string {
  const createdYear = new Date(issue.created).getFullYear().toString()
  return useIssueKeyFolder ? path.join(createdYear, issue.issueKey) : createdYear
}

export function issueRelativePath(
  issue: {created: string; issueKey: string; summary: string},
  options: {issueKeyFileName?: boolean; issueKeyFolder?: boolean},
): string {
  return path.join(
    issueRelativeDir(issue, options.issueKeyFolder ?? false),
    issueFileName(issue, options.issueKeyFileName ?? false),
  )
}

// issueKeyFolderありなら課題フォルダ直下のattachments/、なしなら年フォルダのattachments/{課題キー}/
function attachmentDirSegments(issueKey: string, useIssueKeyFolder: boolean): string[] {
  return useIssueKeyFolder ? ['attachments'] : ['attachments', issueKey]
}

export function attachmentRelativePath(
  issue: {created: string; issueKey: string},
  attachment: Pick<IssueAttachment, 'id' | 'name'>,
  options: {issueKeyFolder?: boolean},
): string {
  return path.join(
    issueRelativeDir(issue, options.issueKeyFolder ?? false),
    ...attachmentDirSegments(issue.issueKey, options.issueKeyFolder ?? false),
    attachmentFileName(attachment),
  )
}

export function attachmentMarkdownLink(
  issue: {issueKey: string},
  attachment: Pick<IssueAttachment, 'id' | 'name'>,
  options: {issueKeyFolder?: boolean},
): string {
  const segments = attachmentDirSegments(issue.issueKey, options.issueKeyFolder ?? false)
  return encodeLinkDestination(['.', ...segments, attachmentFileName(attachment)].join('/'))
}

export function issueUrl(domain: string, issueKey: string): string {
  return `${backlogOrigin(domain)}/view/${issueKey}`
}

// prune用: 保存時と同じ命名ロジックで期待パス集合を構築する
export function buildIssueExpectedPaths(
  issues: Issue[],
  options: {issueKeyFileName?: boolean; issueKeyFolder?: boolean},
): ExpectedPaths {
  const expectedFiles = new Set<string>()
  const expectedDirs = new Set<string>()

  for (const issue of issues) {
    expectedFiles.add(issueRelativePath(issue, options).normalize('NFC'))

    let dir = issueRelativeDir(issue, options.issueKeyFolder ?? false)
    while (dir && dir !== '.') {
      expectedDirs.add(dir.normalize('NFC'))
      dir = path.dirname(dir)
    }
  }

  return {expectedDirs, expectedFiles}
}
