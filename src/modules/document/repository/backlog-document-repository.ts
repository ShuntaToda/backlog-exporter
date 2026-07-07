import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {DocumentRepository} from '../domain/document-repository.js'
import {DocumentDetail, DocumentTree} from '../domain/document.js'

export function newBacklogDocumentRepository(client: BacklogHttpClient): DocumentRepository {
  return {
    async fetchAllTitles(projectId) {
      const titlesById = new Map<string, string>()
      const pageSize = 100
      let offset = 0

      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const page = await client.getJson<Array<{id: string; title: string}>>('/documents', {
          count: pageSize.toString(),
          offset: offset.toString(),
          'projectId[]': projectId.toString(),
        })

        for (const doc of page) {
          titlesById.set(doc.id, doc.title)
        }

        if (page.length < pageSize) {
          break
        }

        offset += pageSize
      }

      return titlesById
    },

    async fetchDetail(documentId) {
      return client.getJson<DocumentDetail>(`/documents/${documentId}`)
    },

    async fetchTree(projectId) {
      return client.getJson<DocumentTree>('/documents/tree', {projectIdOrKey: projectId.toString()})
    },
  }
}
