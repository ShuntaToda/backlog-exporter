import {Issue} from './issue.js'

export function filterIssuesUpdatedSince(issues: Issue[], lastUpdated?: string): Issue[] {
  if (!lastUpdated) {
    return issues
  }

  const lastUpdatedDate = new Date(lastUpdated)
  return issues.filter((issue) => new Date(issue.updated) > lastUpdatedDate)
}
