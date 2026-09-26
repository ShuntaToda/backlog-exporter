import {escapeLinkText, rewriteInlineImages} from '../../../shared/attachment.js'
import {wrapBody} from '../../../shared/markdown/body-marker.js'
import {IssueParent, IssueRef, IssueRelations} from './issue-relations.js'
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

// Backlogのカテゴリーは複数設定できるため、カンマ区切りで並べる
export function formatCategories(categories?: Issue['category']): string {
  if (!categories || categories.length === 0) return '未設定'
  return categories.map((category) => category.name).join(', ')
}

export type IssueUrlResolver = (issueKey: string) => string

// URL解決関数が無い場合は壊れたリンクを書かないよう、ラベルだけを出す
function issueRefLink(ref: IssueRef, issueUrl?: IssueUrlResolver): string {
  const label = `${ref.issueKey} ${ref.summary}`.trim()
  return issueUrl ? `[${escapeLinkText(label)}](${issueUrl(ref.issueKey)})` : label
}

// 課題キーを解決できなかった親はリンクにできないため、Backlog上のIDだけを出す
export function buildParentIssueLine(parent: IssueParent | null, issueUrl?: IssueUrlResolver): string {
  if (!parent) return ''
  if (!parent.ref) return `\n- 親課題: (ID: ${parent.parentIssueId})`
  return `\n- 親課題: ${issueRefLink(parent.ref, issueUrl)}`
}

// 件数が可変なので基本情報の箇条書きではなく独立セクションにする
export function buildChildIssuesSection(children: IssueRef[], issueUrl?: IssueUrlResolver): string {
  if (children.length === 0) return ''
  const lines = children.map((child) => `- ${issueRefLink(child, issueUrl)}`)
  return `\n\n## 子課題\n\n${lines.join('\n')}`
}

export interface BuildIssueMarkdownOptions {
  attachmentLinks?: Map<number, string>
  issueUrl?: IssueUrlResolver
  relations?: IssueRelations
}

export function buildIssueMarkdown(
  issue: Issue,
  comments: IssueComment[],
  backlogIssueUrl: string,
  options: BuildIssueMarkdownOptions = {},
): string {
  const {attachmentLinks, issueUrl, relations} = options
  const rewriteBody = (text: string) => rewriteInlineImages(text, issue.attachments, attachmentLinks)
  const commentsSection = buildCommentsSection(comments, backlogIssueUrl, rewriteBody)
  const customFieldsSection = createCustomFieldsSection(issue.customFields)
  const attachmentsSection = buildAttachmentsSection(issue.attachments, attachmentLinks)
  const parentIssueLine = buildParentIssueLine(relations?.parent ?? null, issueUrl)
  const childIssuesSection = buildChildIssuesSection(relations?.children ?? [], issueUrl)

  const assigneeName = issue.assignee ? issue.assignee.name : '未割り当て'
  const startDate = issue.startDate ? new Date(issue.startDate).toLocaleDateString('ja-JP') : '未設定'
  const dueDate = issue.dueDate ? new Date(issue.dueDate).toLocaleDateString('ja-JP') : '未設定'

  return `# ${issue.summary}

## 基本情報
- 課題キー: ${issue.issueKey}
- 種別: ${issue.issueType.name}
- カテゴリー: ${formatCategories(issue.category)}
- ステータス: ${issue.status.name}
- 優先度: ${issue.priority.name}
- 担当者: ${assigneeName}${parentIssueLine}
- 開始日: ${startDate}
- 期限日: ${dueDate}
- 作成日時: ${new Date(issue.created).toLocaleString('ja-JP')}
- 更新日時: ${new Date(issue.updated).toLocaleString('ja-JP')}
- [Backlog Issue Link](${backlogIssueUrl})${childIssuesSection}${customFieldsSection}${attachmentsSection}

## 詳細

${wrapBody(issue.description ? rewriteBody(issue.description) : '詳細情報なし')}${commentsSection}`
}
