import {escapeLinkText} from '../../../shared/attachment.js'
import {wrapBody} from '../../../shared/markdown/body-marker.js'
import {WikiAttachment} from './wiki.js'

export interface WikiAttachmentsView {
  items?: WikiAttachment[]
  // ダウンロード済みの添付のみが持つ、Markdownからのローカル相対リンク
  localLinks?: Map<number, string>
}

// ダウンロード済みの添付はローカルへの相対リンク付き、未ダウンロードはメタデータのみを出力する
function buildAttachmentsSection(attachments: WikiAttachmentsView): string {
  if (!attachments.items || attachments.items.length === 0) {
    return ''
  }

  const lines = attachments.items.map((attachment) => {
    const fileSize = `${(attachment.size / 1024).toFixed(1)} KB`
    const link = attachments.localLinks?.get(attachment.id)
    return link ? `- [${escapeLinkText(attachment.name)}](${link}) (${fileSize})` : `- ${attachment.name} (${fileSize})`
  })

  return `## 添付ファイル\n\n${lines.join('\n')}\n\n`
}

// 本文はBacklogの原文を維持する（添付参照記法の書き換えは行わない）
export function buildWikiMarkdown(
  wikiName: string,
  backlogWikiUrl: string,
  content: string,
  attachments: WikiAttachmentsView = {},
): string {
  const attachmentsSection = buildAttachmentsSection(attachments)
  return `# ${wikiName}\n\n[Backlog Wiki Link](${backlogWikiUrl})\n\n${attachmentsSection}${wrapBody(content || '（内容なし）')}`
}
