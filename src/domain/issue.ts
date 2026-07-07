/**
 * Backlogの課題
 */
export interface Issue {
  assignee: null | {id: number; name: string}
  created: string
  customFields: CustomField[]
  description: string
  dueDate: null | string
  id: number
  issueKey: string
  issueType: {id: number; name: string}
  priority: {id: number; name: string}
  startDate: null | string
  status: {id: number; name: string}
  summary: string
  updated: string
}

/**
 * 課題のカスタム属性
 */
export interface CustomField {
  id: number
  name: string
  value: unknown
}

/**
 * 課題のコメント
 */
export interface IssueComment {
  content: string
  created: string
  createdUser: {
    id: number
    name: string
  }
  id: number
}
