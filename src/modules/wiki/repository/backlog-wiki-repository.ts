import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {WikiRepository} from '../domain/wiki-repository.js'
import {WikiDetail, WikiSummary} from '../domain/wiki.js'

export function newBacklogWikiRepository(client: BacklogHttpClient): WikiRepository {
  return {
    async downloadAttachment(wikiId, attachmentId) {
      return client.getBinary(`/wikis/${wikiId}/attachments/${attachmentId}`)
    },

    async fetchDetail(wikiId, projectIdOrKey) {
      return client.getJson<WikiDetail>(`/wikis/${wikiId}`, {projectIdOrKey})
    },

    async fetchWikis(projectIdOrKey) {
      return client.getJson<WikiSummary[]>('/wikis', {projectIdOrKey})
    },
  }
}
