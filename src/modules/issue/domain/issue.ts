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

export interface CustomField {
  id: number
  name: string
  value: unknown
}

export interface IssueComment {
  changeLog?: IssueCommentChange[]
  content: null | string
  created: string
  createdUser: {
    id: number
    name: string
  }
  id: number
}

// 担当者・状態などの変更通知（本文なしコメントの正体）
export interface IssueCommentChange {
  field: string
  newValue: null | string
  originalValue: null | string
}
