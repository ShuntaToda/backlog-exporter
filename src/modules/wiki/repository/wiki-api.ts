import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {WikiDetail, WikiSummary} from '../domain/wiki.js'

export async function fetchWikis(client: BacklogHttpClient, projectIdOrKey: string): Promise<WikiSummary[]> {
  return client.getJson<WikiSummary[]>('/wikis', {projectIdOrKey})
}

export async function fetchWikiDetail(
  client: BacklogHttpClient,
  wikiId: string,
  projectIdOrKey: string,
): Promise<WikiDetail> {
  return client.getJson<WikiDetail>(`/wikis/${wikiId}`, {projectIdOrKey})
}
