/**
 * Backlogのドキュメントツリーのノード。
 * 子を持つノードはフォルダとして扱われるが、Backlogのドキュメントは
 * 子を持ちながら自身の本文も持てる（親ドキュメント）。
 */
export interface DocumentNode {
  children: DocumentNode[]
  emoji?: string
  emojiType?: string
  id: string
  name: string
  updated?: string
}

/**
 * ドキュメントツリーAPIのレスポンス
 */
export interface DocumentTree {
  activeTree: {
    children: DocumentNode[]
    id: string
  }
}

/**
 * ドキュメント一覧APIのエントリ
 */
export interface DocumentSummary {
  id: string
  title: string
}

/**
 * ドキュメント詳細APIのレスポンス
 */
export interface DocumentDetail {
  attachments: Array<{
    created: string
    createdUser: {
      id: number
      name: string
    }
    id: number
    name: string
    size: number
  }>
  created: string
  createdUser: {
    id: number
    name: string
  }
  emoji?: string
  id: string
  json: string
  plain: string
  statusId: number
  tags: Array<{
    id: number
    name: string
  }>
  title: string
  updated: string
  updatedUser: {
    id: number
    name: string
  }
}
