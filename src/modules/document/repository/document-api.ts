import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {DocumentDetail, DocumentTree} from '../domain/document.js'

export async function fetchDocumentTree(client: BacklogHttpClient, projectId: number): Promise<DocumentTree> {
  return client.getJson<DocumentTree>('/documents/tree', {projectIdOrKey: projectId.toString()})
}

export async function fetchDocumentDetail(client: BacklogHttpClient, documentId: string): Promise<DocumentDetail> {
  return client.getJson<DocumentDetail>(`/documents/${documentId}`)
}

export async function fetchAllDocumentTitles(
  client: BacklogHttpClient,
  projectId: number,
): Promise<Map<string, string>> {
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
}
