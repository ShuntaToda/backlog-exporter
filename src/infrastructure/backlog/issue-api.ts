import {Issue, IssueComment} from '../../domain/issue.js'
import {BacklogHttpClient} from './http-client.js'

/**
 * 課題一覧を1ページ分取得する
 */
export async function fetchIssuesPage(
  client: BacklogHttpClient,
  options: {count: number; offset: number; projectId: number; statusId?: string},
): Promise<Issue[]> {
  const params: Record<string, string> = {
    count: options.count.toString(),
    offset: options.offset.toString(),
    'projectId[]': options.projectId.toString(),
  }

  if (options.statusId) {
    params['statusId[]'] = options.statusId
  }

  return client.getJson<Issue[]>('/issues', params)
}

/**
 * 課題IDまたはキーを指定して課題を1件取得する
 */
export async function fetchIssueByIdOrKey(client: BacklogHttpClient, issueIdOrKey: string): Promise<Issue> {
  return client.getJson<Issue>(`/issues/${issueIdOrKey}`)
}

/**
 * 課題のコメントを全件取得する（100件ずつページングし、古い順に並べて返す）
 */
export async function fetchAllComments(client: BacklogHttpClient, issueKey: string): Promise<IssueComment[]> {
  const allComments: IssueComment[] = []
  let minId: number | undefined

  for (;;) {
    const params: Record<string, string> = {count: '100'}
    if (minId !== undefined) {
      params.minId = minId.toString()
    }

    // eslint-disable-next-line no-await-in-loop
    const comments = await client.getJson<IssueComment[]>(`/issues/${issueKey}/comments`, params)
    allComments.push(...comments)

    if (comments.length < 100) {
      break
    }

    // 取得したコメントの最後のIDを次のリクエストのminIdとして使用
    minId = comments.at(-1)!.id + 1
  }

  // コメントを古い順（昇順）に並び替える
  allComments.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
  return allComments
}
