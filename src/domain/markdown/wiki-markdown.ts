import {wrapBody} from './body-marker.js'

/**
 * WikiのMarkdownファイル内容を組み立てる。
 * 本文が空の場合は課題・ドキュメントと同様にプレースホルダを入れて種別間の出力を揃える。
 */
export function buildWikiMarkdown(wikiName: string, backlogWikiUrl: string, content: string): string {
  return `# ${wikiName}\n\n[Backlog Wiki Link](${backlogWikiUrl})\n\n${wrapBody(content || '（内容なし）')}`
}
