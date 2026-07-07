import {DocumentDetail, DocumentTree} from '../../domain/document.js'
import {BacklogHttpClient} from './http-client.js'

/**
 * プロジェクトのドキュメントツリーを取得する
 */
export async function fetchDocumentTree(client: BacklogHttpClient, projectId: number): Promise<DocumentTree> {
  return client.getJson<DocumentTree>('/documents/tree', {projectIdOrKey: projectId.toString()})
}

/**
 * ドキュメントの詳細を取得する
 */
export async function fetchDocumentDetail(client: BacklogHttpClient, documentId: string): Promise<DocumentDetail> {
  return client.getJson<DocumentDetail>(`/documents/${documentId}`)
}

/**
 * ドキュメント一覧APIから全ドキュメントの id → title の対応を取得する
 * （100件ずつページングして全件を集める）
 */
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
