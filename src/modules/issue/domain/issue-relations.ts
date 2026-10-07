import {Issue} from './issue.js'

// 親課題・子課題の表示に必要な最小フィールド
export interface IssueRef {
  issueKey: string
  summary: string
}

// refは課題キーを解決できたかどうか。別プロジェクトの親などは取得対象に含まれずnullになる
export interface IssueParent {
  parentIssueId: number
  ref: IssueRef | null
}

export interface IssueRelations {
  children: IssueRef[]
  parent: IssueParent | null
}

export function toIssueRef(issue: Pick<Issue, 'issueKey' | 'summary'>): IssueRef {
  return {issueKey: issue.issueKey, summary: issue.summary}
}

export function buildIssueRefIndex(issues: Issue[]): Map<number, IssueRef> {
  return new Map(issues.map((issue) => [issue.id, toIssueRef(issue)]))
}

// parentIssueIdでグルーピングするだけなので、親子孫の3階層でもそのまま成立する
export function buildChildIndex(issues: Issue[]): Map<number, IssueRef[]> {
  const childIndex = new Map<number, IssueRef[]>()

  // 一覧APIの返却順はソート指定に依存するため、Backlogの画面に合わせて課題ID昇順に固定する
  for (const issue of [...issues].sort((a, b) => a.id - b.id)) {
    if (issue.parentIssueId === null || issue.parentIssueId === undefined) continue
    const siblings = childIndex.get(issue.parentIssueId)
    if (siblings) {
      siblings.push(toIssueRef(issue))
    } else {
      childIndex.set(issue.parentIssueId, [toIssueRef(issue)])
    }
  }

  return childIndex
}

// 課題のファイルには直接の親と子しか載らないため、更新された課題の上下1段を書き直せば親子の表示が揃う
export function withParentsAndChildren(allIssues: Issue[], updatedIssues: Issue[]): Issue[] {
  const updatedIds = new Set(updatedIssues.map((issue) => issue.id))
  const parentIds = new Set(
    updatedIssues
      .map((issue) => issue.parentIssueId)
      .filter((parentIssueId): parentIssueId is number => parentIssueId !== null),
  )

  return allIssues.filter(
    (issue) =>
      updatedIds.has(issue.id) ||
      parentIds.has(issue.id) ||
      (issue.parentIssueId !== null && updatedIds.has(issue.parentIssueId)),
  )
}

export function findChildren(issue: Issue, childIndex: Map<number, IssueRef[]>): IssueRef[] {
  return childIndex.get(issue.id) ?? []
}

export function findParent(issue: Issue, refIndex: Map<number, IssueRef>): IssueParent | null {
  const parentIssueId = issue.parentIssueId ?? null
  if (parentIssueId === null) return null

  return {parentIssueId, ref: refIndex.get(parentIssueId) ?? null}
}
