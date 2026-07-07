import {Issue, IssueComment} from './issue.js'

export interface IssueRepository {
  fetchAllComments(issueKey: string): Promise<IssueComment[]>
  fetchByIdOrKey(issueIdOrKey: string): Promise<Issue>
  fetchPage(options: {count: number; offset: number; projectId: number; statusId?: string}): Promise<Issue[]>
}
