import {wrapBody} from '../../../shared/markdown/body-marker.js'
import {CustomField, Issue, IssueComment} from './issue.js'

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

export function buildCommentsSection(comments: IssueComment[], backlogIssueUrl: string): string {
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
    }\n- **日時**: ${commentDate}\n- [Backlog Comment Link](${backlogCommentUrl})\n\n${comment.content || '(内容なし)'}\n\n---\n`
    commentIndex++
  }

  // 最後の区切り線を削除
  return commentsSection.slice(0, -5)
}

export function buildIssueMarkdown(issue: Issue, comments: IssueComment[], backlogIssueUrl: string): string {
  const commentsSection = buildCommentsSection(comments, backlogIssueUrl)
  const customFieldsSection = createCustomFieldsSection(issue.customFields)

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
- [Backlog Issue Link](${backlogIssueUrl})${customFieldsSection}

## 詳細

${wrapBody(issue.description || '詳細情報なし')}${commentsSection}`
}
