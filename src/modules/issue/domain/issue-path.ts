import path from 'node:path'

import {backlogOrigin} from '../../../shared/backlog-url.js'
import {sanitizeAttachmentFileName, sanitizeFileName} from '../../../shared/file-name.js'
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

// 添付IDを前置して同一課題内の同名添付の衝突を防ぎ、存在チェックだけでDL済み判定できるようにする
export function attachmentFileName(attachment: Pick<IssueAttachment, 'id' | 'name'>): string {
  return `${attachment.id}_${sanitizeAttachmentFileName(attachment.name)}`
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

// Markdownファイルから添付への相対リンク。丸括弧はインラインリンクを壊すためエンコードする
export function attachmentMarkdownLink(
  issue: {issueKey: string},
  attachment: Pick<IssueAttachment, 'id' | 'name'>,
  options: {issueKeyFolder?: boolean},
): string {
  const segments = attachmentDirSegments(issue.issueKey, options.issueKeyFolder ?? false)
  return ['.', ...segments, attachmentFileName(attachment)].join('/').replaceAll('(', '%28').replaceAll(')', '%29')
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

  const addDirs = (dir: string) => {
    let current = dir
    while (current && current !== '.') {
      expectedDirs.add(current.normalize('NFC'))
      current = path.dirname(current)
    }
  }

  for (const issue of issues) {
    expectedFiles.add(issueRelativePath(issue, options).normalize('NFC'))
    addDirs(issueRelativeDir(issue, options.issueKeyFolder ?? false))

    // .md拡張子の添付ファイルがpruneで誤削除されないよう、添付パスも期待集合に含める
    for (const attachment of issue.attachments ?? []) {
      const attachmentPath = attachmentRelativePath(issue, attachment, options)
      expectedFiles.add(attachmentPath.normalize('NFC'))
      addDirs(path.dirname(attachmentPath))
    }
  }

  return {expectedDirs, expectedFiles}
}
