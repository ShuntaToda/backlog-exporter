/**
 * BacklogのWiki（一覧APIのエントリ）
 */
export interface WikiSummary {
  id: string
  name: string
  updated: string
}

/**
 * BacklogのWiki詳細
 */
export interface WikiDetail {
  content?: string
  id: string
  name: string
}
