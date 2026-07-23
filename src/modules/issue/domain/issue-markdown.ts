import {wrapBody} from '../../../shared/markdown/body-marker.js'
import {CustomField, Issue, IssueAttachment, IssueComment, IssueCommentChange} from './issue.js'

// Backlogの変更履歴（changeLog）のfieldを画面表示に合わせた日本語ラベルへ変換する
const CHANGE_FIELD_LABELS: Record<string, string> = {
  actualHours: '実績時間',
  assigner: '担当者',
  attachment: '添付ファイル',
  component: 'カテゴリー',
  description: '詳細',
  estimatedHours: '予定時間',
  issueType: '種別',
  limitDate: '期限日',
  milestone: 'マイルストーン',
  notification: 'お知らせ',
  parentIssue: '親課題',
  priority: '優先度',
  resolution: '完了理由',
  startDate: '開始日',
  status: '状態',
  summary: '件名',
  version: '発生バージョン',
}

// 詳細やカスタム属性の変更値には複数行の長文が入ることがあり、
// そのまま出すとリスト構造が崩れるため1行化して切り詰める
function formatChangeValue(value: null | string): string {
  if (!value) return '未設定'
  const singleLine = value.replaceAll(/\s*\n\s*/g, ' ').trim()
  return singleLine.length > 50 ? `${singleLine.slice(0, 50)}…` : singleLine
}

function formatChange(change: IssueCommentChange): string {
  const label = CHANGE_FIELD_LABELS[change.field] ?? change.field
  return `- ${label}: ${formatChangeValue(change.originalValue)} → ${formatChangeValue(change.newValue)}`
}

// Backlogの添付画像インライン記法（Markdown拡張の ![alt][ファイル名] とBacklog記法の #image(ファイル名)）を
// ダウンロード済みファイルへのローカルリンクに変換する。未ダウンロードの参照は壊さずそのまま残す
export function rewriteInlineImages(
  text: string,
  attachments: IssueAttachment[] | undefined,
  localLinks?: Map<number, string>,
): string {
  if (!text || !attachments || attachments.length === 0 || !localLinks || localLinks.size === 0) {
    return text
  }

  // 同名添付が複数ある場合は記法から特定できないため先勝ちで解決する。
  // 記法内のファイル名はNFD（macOSからのD&D等）で入ることがあるため、照合はNFC正規化で行う
  const linkByName = new Map<string, string>()
  for (const attachment of attachments) {
    const link = localLinks.get(attachment.id)
    const name = attachment.name.normalize('NFC')
    if (link && !linkByName.has(name)) {
      linkByName.set(name, link)
    }
  }

  const toLocalImage = (match: string, name: string) => {
    const link = linkByName.get(name.normalize('NFC'))
    return link ? `![${escapeLinkText(name)}](${link})` : match
  }

  return text
    .replaceAll(/!\[[^\]]*\]\[([^\]]+)\]/g, toLocalImage)
    .replaceAll(/#image\(([^)]+)\)/g, toLocalImage)
}

function buildCommentBody(comment: IssueComment, rewriteBody: (text: string) => string): string {
  const parts: string[] = []

  if (comment.content) {
    parts.push(rewriteBody(comment.content))
  }

  if (comment.changeLog && comment.changeLog.length > 0) {
    parts.push(['**変更内容**', ...comment.changeLog.map((change) => formatChange(change))].join('\n'))
  }

  return parts.length > 0 ? parts.join('\n\n') : '(内容なし)'
}

export function createCustomFieldsSection(customFields?: CustomField[]): string {
  if (!customFields || customFields.length === 0) {
    return ''
  }

  let customFieldsSection = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n'

  for (const customField of customFields) {
    let fieldValue = 'なし'
    if (customField.value !== null && customField.value !== undefined) {
      if (Array.isArray(customField.value)) {
        // 配列の場合（複数選択など）
        fieldValue = (customField.value as Array<{name?: string; value?: string}>)
          .map((item) => item.name || item.value || String(item))
          .join(', ')
      } else if (typeof customField.value === 'object' && customField.value !== null) {
        // オブジェクトの場合（単一選択など）
        const valueObj = customField.value as {name?: string; value?: string}
        fieldValue = valueObj.name || valueObj.value || String(customField.value)
      } else {
        // プリミティブ値の場合
        fieldValue = String(customField.value)
      }
    }

    // テーブル内では改行をHTMLの<br>タグに変換し、パイプ文字をエスケープ
    const escapedFieldValue = fieldValue.replaceAll('|', String.raw`\|`).replaceAll('\n', '<br>')

    customFieldsSection += `| ${customField.name} | ${escapedFieldValue} |\n`
  }

  return customFieldsSection
}

// ファイル名中の角括弧はリンク構文を壊すためエスケープする
function escapeLinkText(name: string): string {
  return name.replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`)
}

// ダウンロード済みの添付はローカルへの相対リンク付き、未ダウンロードはメタデータのみを出力する
export function buildAttachmentsSection(
  attachments: IssueAttachment[] | undefined,
  localLinks?: Map<number, string>,
): string {
  if (!attachments || attachments.length === 0) {
    return ''
  }

  const lines = attachments.map((attachment) => {
    const fileSize = `${(attachment.size / 1024).toFixed(1)} KB`
    const link = localLinks?.get(attachment.id)
    return link ? `- [${escapeLinkText(attachment.name)}](${link}) (${fileSize})` : `- ${attachment.name} (${fileSize})`
  })

  return `\n\n## 添付ファイル\n\n${lines.join('\n')}`
}

export function buildCommentsSection(
  comments: IssueComment[],
  backlogIssueUrl: string,
  rewriteBody: (text: string) => string = (text) => text,
): string {
  if (comments.length === 0) {
    return ''
  }

  let commentsSection = '\n\n## コメント\n'
  let commentIndex = 1
  for (const comment of comments) {
    const commentDate = new Date(comment.created).toLocaleString('ja-JP')
    const backlogCommentUrl = `${backlogIssueUrl}#comment-${comment.id}`
    commentsSection += `\n### コメント ${commentIndex}\n- **投稿者**: ${
      comment.createdUser.name
    }\n- **日時**: ${commentDate}\n- [Backlog Comment Link](${backlogCommentUrl})\n\n${buildCommentBody(comment, rewriteBody)}\n\n---\n`
    commentIndex++
  }

  // 最後の区切り線を削除
  return commentsSection.slice(0, -5)
}

export function buildIssueMarkdown(
  issue: Issue,
  comments: IssueComment[],
  backlogIssueUrl: string,
  attachmentLinks?: Map<number, string>,
): string {
  const rewriteBody = (text: string) => rewriteInlineImages(text, issue.attachments, attachmentLinks)
  const commentsSection = buildCommentsSection(comments, backlogIssueUrl, rewriteBody)
  const customFieldsSection = createCustomFieldsSection(issue.customFields)
  const attachmentsSection = buildAttachmentsSection(issue.attachments, attachmentLinks)

  const assigneeName = issue.assignee ? issue.assignee.name : '未割り当て'
  const startDate = issue.startDate ? new Date(issue.startDate).toLocaleDateString('ja-JP') : '未設定'
  const dueDate = issue.dueDate ? new Date(issue.dueDate).toLocaleDateString('ja-JP') : '未設定'

  return `# ${issue.summary}

## 基本情報
- 課題キー: ${issue.issueKey}
- 種別: ${issue.issueType.name}
- ステータス: ${issue.status.name}
- 優先度: ${issue.priority.name}
- 担当者: ${assigneeName}
- 開始日: ${startDate}
- 期限日: ${dueDate}
- 作成日時: ${new Date(issue.created).toLocaleString('ja-JP')}
- 更新日時: ${new Date(issue.updated).toLocaleString('ja-JP')}
- [Backlog Issue Link](${backlogIssueUrl})${customFieldsSection}${attachmentsSection}

## 詳細

${wrapBody(issue.description ? rewriteBody(issue.description) : '詳細情報なし')}${commentsSection}`
}
