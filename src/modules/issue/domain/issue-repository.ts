import {Issue, IssueComment} from './issue.js'

export interface IssueRepository {
  downloadAttachment(issueIdOrKey: string, attachmentId: number): Promise<ArrayBuffer>
  fetchAllComments(issueKey: string): Promise<IssueComment[]>
  fetchByIdOrKey(issueIdOrKey: string): Promise<Issue>
  fetchPage(options: {count: number; offset: number; projectId: number; statusId?: string}): Promise<Issue[]>
}
