import {WikiDetail, WikiSummary} from './wiki.js'

export interface WikiRepository {
  fetchDetail(wikiId: string, projectIdOrKey: string): Promise<WikiDetail>
  fetchWikis(projectIdOrKey: string): Promise<WikiSummary[]>
}
