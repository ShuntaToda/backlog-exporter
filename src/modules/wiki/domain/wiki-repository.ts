import {WikiDetail, WikiSummary} from './wiki.js'

export interface WikiRepository {
  downloadAttachment(wikiId: string, attachmentId: number): Promise<ArrayBuffer>
  fetchDetail(wikiId: string, projectIdOrKey: string): Promise<WikiDetail>
  fetchWikis(projectIdOrKey: string): Promise<WikiSummary[]>
}
