/** 本文の開始を示すマーカー（Markdownレンダリング時は不可視のHTMLコメント） */
export const BODY_START_MARKER = '<!-- backlog-exporter:body:start -->'
/** 本文の終了を示すマーカー（Markdownレンダリング時は不可視のHTMLコメント） */
export const BODY_END_MARKER = '<!-- backlog-exporter:body:end -->'

/**
 * 本文を開始・終了マーカーで囲む。
 * 課題・Wiki・ドキュメントで本文（description / content / plain）の範囲を一貫して
 * 機械的に判定・抽出・差し替えできるようにするための共通ヘルパー。
 * 本文自身が `##` 見出し等を含んでも、マーカー間を本文として確実に切り出せる。
 * @param body 本文テキスト
 * @returns マーカーで囲まれた本文ブロック
 */
export function wrapBody(body: string): string {
  return `${BODY_START_MARKER}\n${body}\n${BODY_END_MARKER}`
}
