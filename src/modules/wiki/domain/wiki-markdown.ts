import {wrapBody} from '../../../shared/markdown/body-marker.js'

export function buildWikiMarkdown(wikiName: string, backlogWikiUrl: string, content: string): string {
  return `# ${wikiName}\n\n[Backlog Wiki Link](${backlogWikiUrl})\n\n${wrapBody(content || '（内容なし）')}`
}
