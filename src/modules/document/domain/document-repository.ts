import {DocumentDetail, DocumentTree} from './document.js'

export interface DocumentRepository {
  downloadAttachment(documentId: string, attachmentId: number): Promise<ArrayBuffer>
  fetchAllTitles(projectId: number): Promise<Map<string, string>>
  fetchDetail(documentId: string): Promise<DocumentDetail>
  fetchTree(projectId: number): Promise<DocumentTree>
}
