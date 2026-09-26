import {BacklogHttpClient, QueryParams} from '../../../shared/backlog/http-client.js'
import {IssueRepository} from '../domain/issue-repository.js'
import {Issue, IssueComment} from '../domain/issue.js'

const PAGE_SIZE = 100

function listParams(key: string, values: number[], offset: number): QueryParams {
  return {
    count: PAGE_SIZE.toString(),
    [key]: values.map((value) => value.toString()),
    offset: offset.toString(),
  }
}

export function newBacklogIssueRepository(client: BacklogHttpClient): IssueRepository {
  return {
    async downloadAttachment(issueIdOrKey, attachmentId) {
      return client.getBinary(`/issues/${issueIdOrKey}/attachments/${attachmentId}`)
    },

    async fetchAllComments(issueKey) {
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

        minId = comments.at(-1)!.id + 1
      }

      // コメントを古い順（昇順）に並び替える
      allComments.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
      return allComments
    },

    async fetchByIdOrKey(issueIdOrKey) {
      return client.getJson<Issue>(`/issues/${issueIdOrKey}`)
    },

    async fetchByIds(ids) {
      return client.getJson<Issue[]>('/issues', listParams('id[]', ids, 0))
    },

    // 課題キー指定エクスポートのように取得済み集合に子が含まれない場合の補完用。
    // 複数の親をまとめて指定できるため、課題ごとではなく一括で引く
    async fetchChildren(parentIssueIds) {
      const children: Issue[] = []

      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const page = await client.getJson<Issue[]>(
          '/issues',
          listParams('parentIssueId[]', parentIssueIds, children.length),
        )
        children.push(...page)

        if (page.length < PAGE_SIZE) {
          return children
        }
      }
    },

    async fetchPage(options) {
      const params: Record<string, string> = {
        count: options.count.toString(),
        offset: options.offset.toString(),
        'projectId[]': options.projectId.toString(),
      }

      if (options.statusId) {
        params['statusId[]'] = options.statusId
      }

      return client.getJson<Issue[]>('/issues', params)
    },
  }
}
