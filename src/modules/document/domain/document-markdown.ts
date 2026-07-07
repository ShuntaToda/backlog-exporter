import {wrapBody} from '../../../shared/markdown/body-marker.js'
import {DocumentDetail} from './document.js'

export function buildDocumentMarkdown(documentDetail: DocumentDetail, backlogDocumentUrl: string): string {
  // 添付ファイルリストの作成
  let attachmentsSection = ''
  if (documentDetail.attachments && documentDetail.attachments.length > 0) {
    attachmentsSection = '\n\n## 添付ファイル\n'
    for (const attachment of documentDetail.attachments) {
      const attachmentDate = new Date(attachment.created).toLocaleString('ja-JP')
      const fileSize = (attachment.size / 1024).toFixed(1)
      attachmentsSection += `- **${attachment.name}** (${fileSize} KB) - 作成者: ${attachment.createdUser.name}, 作成日時: ${attachmentDate}\n`
    }
  }

  // タグリストの作成
  let tagsSection = ''
  if (documentDetail.tags && documentDetail.tags.length > 0) {
    tagsSection = '\n\n## タグ\n'
    for (const tag of documentDetail.tags) {
      tagsSection += `- ${tag.name}\n`
    }
  }

  // 作成者・更新者情報
  const createdDate = new Date(documentDetail.created).toLocaleString('ja-JP')
  const updatedDate = new Date(documentDetail.updated).toLocaleString('ja-JP')

  return `# ${documentDetail.title}

[Backlog Document Link](${backlogDocumentUrl})

**ステータス**: ${documentDetail.statusId}${documentDetail.emoji ? ` ${documentDetail.emoji}` : ''}
**作成者**: ${documentDetail.createdUser.name}
**作成日時**: ${createdDate}
**更新者**: ${documentDetail.updatedUser.name}
**更新日時**: ${updatedDate}

## 内容

${wrapBody(documentDetail.plain || '（内容なし）')}${attachmentsSection}${tagsSection}`
}
