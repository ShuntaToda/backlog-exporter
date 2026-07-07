import {WikiDetail, WikiSummary} from '../../domain/wiki.js'
import {BacklogHttpClient} from './http-client.js'

/**
 * プロジェクトのWiki一覧を取得する
 */
export async function fetchWikis(client: BacklogHttpClient, projectIdOrKey: string): Promise<WikiSummary[]> {
  return client.getJson<WikiSummary[]>('/wikis', {projectIdOrKey})
}

/**
 * Wikiの詳細を取得する
 */
export async function fetchWikiDetail(
  client: BacklogHttpClient,
  wikiId: string,
  projectIdOrKey: string,
): Promise<WikiDetail> {
  return client.getJson<WikiDetail>(`/wikis/${wikiId}`, {projectIdOrKey})
}
