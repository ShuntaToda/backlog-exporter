export interface DocumentNode {
  children: DocumentNode[]
  emoji?: string
  emojiType?: string
  id: string
  name: string
  updated?: string
}

export interface DocumentTree {
  activeTree: {
    children: DocumentNode[]
    id: string
  }
}

export interface DocumentSummary {
  id: string
  title: string
}

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
