import path from 'node:path'

import {backlogOrigin} from '../../../shared/backlog-url.js'
import {sanitizeFileName} from '../../../shared/file-name.js'

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

export function issueUrl(domain: string, issueKey: string): string {
  return `${backlogOrigin(domain)}/view/${issueKey}`
}
