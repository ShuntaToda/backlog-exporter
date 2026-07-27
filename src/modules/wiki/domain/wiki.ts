export interface WikiSummary {
  id: string
  name: string
  updated: string
}

export interface WikiAttachment {
  id: number
  name: string
  size: number
}

export interface WikiDetail {
  attachments?: WikiAttachment[]
  content?: string
  id: string
  name: string
}
