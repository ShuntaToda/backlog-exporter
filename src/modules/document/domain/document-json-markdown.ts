interface ProseMirrorMark {
  attrs?: Record<string, unknown>
  type?: string
}

interface ProseMirrorNode {
  attrs?: Record<string, unknown>
  content?: ProseMirrorNode[]
  marks?: ProseMirrorMark[]
  text?: string
  type?: string
}

const BLOCK_TYPES = new Set([
  'blockquote',
  'bulletList',
  'codeBlock',
  'heading',
  'horizontalRule',
  'orderedList',
  'paragraph',
  'table',
  'taskList',
])

// マーク適用順。codeは最内側に置き、他の記号がコードスパンの外に出るようにする
const MARK_ORDER = ['code', 'bold', 'italic', 'strike', 'link']

function isNode(value: unknown): value is ProseMirrorNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isListNode(node: ProseMirrorNode): boolean {
  return node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList'
}

function isBlockLike(node: ProseMirrorNode): boolean {
  return typeof node.type === 'string' && BLOCK_TYPES.has(node.type)
}

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  return Array.isArray(node.content) ? node.content.filter((child) => isNode(child)) : []
}

function nodeMarks(node: ProseMirrorNode): ProseMirrorMark[] {
  return (Array.isArray(node.marks) ? node.marks : []).filter((mark) => isNode(mark))
}

function attrString(node: ProseMirrorNode, key: string): string | undefined {
  const value = node.attrs?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function markOrder(mark: ProseMirrorMark): number {
  const index = MARK_ORDER.indexOf(mark.type ?? '')
  // 未知のマークは最外側に置く（-1で最内側に来るのを防ぐ）
  return index === -1 ? MARK_ORDER.length : index
}

function sortMarks(marks: ProseMirrorMark[]): ProseMirrorMark[] {
  return [...marks].sort((a, b) => markOrder(a) - markOrder(b))
}

// 隣接テキストのマークが同一かの判定用。属性まで含めて比較する
function markKey(mark: ProseMirrorMark): string {
  return `${mark.type ?? ''}:${JSON.stringify(mark.attrs ?? {})}`
}

function marksKey(marks: ProseMirrorMark[]): string {
  return sortMarks(marks)
    .map((mark) => markKey(mark))
    .join('|')
}

// 連続するバッククォートの最長連を求め、それより長いフェンス/デリミタを選ぶ
function longestBacktickRun(text: string): number {
  let longest = 0
  for (const run of text.matchAll(/`+/g)) {
    longest = Math.max(longest, run[0].length)
  }

  return longest
}

function inlineCode(text: string): string {
  const delimiter = '`'.repeat(longestBacktickRun(text) + 1)
  // 内容の端がバッククォートの場合、区切りと繋がらないよう空白で隔てる
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${delimiter}${pad}${text}${pad}${delimiter}`
}

// CommonMarkのリンク先は空白・括弧を含む場合<>で囲う必要がある
function linkDestination(destination: string): string {
  return /[\s()]/.test(destination) ? `<${destination}>` : destination
}

function escapeBracketText(text: string): string {
  return text.replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`)
}

// 行頭に来るとブロック記法として解釈される文字をエスケープする。
// リスト内の字下げはリスト側で付けるため、ここではテキスト自身の先頭空白だけを見る
function escapeBlockStart(text: string): string {
  return (
    text
      // 4スペース以上の字下げはコードブロックになるため3つまでに詰める
      .replace(/^ {4,}/, '   ')
      .replace(/^(\s*)([#>])/, String.raw`$1\$2`)
      .replace(/^(\s*)(~~~)/, String.raw`$1\$2`)
      .replace(/^(\s*)([+-])(\s)/, String.raw`$1\$2$3`)
      .replace(/^(\s*)(\d{1,9})([).])(\s)/, String.raw`$1$2\$3$4`)
      // setext見出しの下線（=== や ---）は行全体がその文字のときだけ成立する
      .replace(/^(\s*)([=-])(?=[=-]*\s*$)/, String.raw`$1\$2`)
  )
}

// 自動リンクされるURLはエスケープするとリンク先が壊れるため素通しする
const URL_PATTERN = /https?:\/\/[^\s<>]+/g

// インラインの強調記法として解釈されうる文字のみを対象にする（CJK約物は対象外）
function escapeInline(text: string): string {
  let result = ''
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    result += escapeInlineSpan(text.slice(last, match.index)) + match[0]
    last = match.index + match[0].length
  }

  return result + escapeInlineSpan(text.slice(last))
}

function escapeInlineSpan(text: string): string {
  return text.replaceAll(/[[\\\]_`*<]/g, String.raw`\$&`)
}

function applyMark(text: string, mark: ProseMirrorMark): string {
  switch (mark.type) {
    case 'bold': {
      return wrapKeepingWhitespace(text, '**')
    }

    case 'code': {
      return inlineCode(text)
    }

    case 'italic': {
      return wrapKeepingWhitespace(text, '*')
    }

    case 'link': {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
      return `[${text}](${linkDestination(href)})`
    }

    case 'strike': {
      return wrapKeepingWhitespace(text, '~~')
    }

    default: {
      return text
    }
  }
}

// 区切り記号の内側に空白があると強調が成立しないため、空白を外側へ追い出す
function wrapKeepingWhitespace(text: string, delimiter: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  if (!match) return `${delimiter}${text}${delimiter}`
  const [, leading, core, trailing] = match
  if (core === '') return text
  return `${leading}${delimiter}${core}${delimiter}${trailing}`
}

function renderMarkedText(text: string, marks: ProseMirrorMark[], atLineStart: boolean): string {
  if (text === '') return ''

  const hasCode = marks.some((mark) => mark.type === 'code')
  // コードマーク内はエスケープせず原文のまま出す
  let result = hasCode ? text : escapeInline(text)
  if (!hasCode && atLineStart) result = escapeBlockStart(result)

  for (const mark of sortMarks(marks)) {
    result = applyMark(result, mark)
  }

  return result
}

// 同じマークの連続テキストは1つに束ねる（**a****b** のような無効な出力を防ぐ）
function coalesceTextNodes(nodes: ProseMirrorNode[]): ProseMirrorNode[] {
  const result: ProseMirrorNode[] = []
  for (const node of nodes) {
    const previous = result.at(-1)
    if (
      node.type === 'text' &&
      previous?.type === 'text' &&
      marksKey(nodeMarks(previous)) === marksKey(nodeMarks(node))
    ) {
      result[result.length - 1] = {...previous, text: (previous.text ?? '') + (node.text ?? '')}
      continue
    }

    result.push(node)
  }

  return result
}

// 隣接テキストが共通の外側マーク（**等）を持つ場合、閉じて開き直すと強調が壊れる。
// 共通マークで全体を1度だけ包み、内側の差分マークだけを各テキストに適用する
function renderTextRun(nodes: ProseMirrorNode[], atLineStart: boolean): string {
  const shared: ProseMirrorMark[] = []
  if (nodes.length > 1) {
    const first = sortMarks(nodeMarks(nodes[0]))
    for (const mark of first) {
      // codeは内容ごとに区切りが変わるため共通化しない
      if (mark.type === 'code') continue
      if (nodes.every((node) => nodeMarks(node).some((other) => markKey(other) === markKey(mark)))) {
        shared.push(mark)
      }
    }
  }

  const sharedKeys = new Set(shared.map((mark) => markKey(mark)))
  let inner = ''
  for (const [index, node] of nodes.entries()) {
    const rest = nodeMarks(node).filter((mark) => !sharedKeys.has(markKey(mark)))
    inner += renderMarkedText(node.text ?? '', rest, atLineStart && index === 0)
  }

  let result = inner
  for (const mark of sortMarks(shared)) {
    result = applyMark(result, mark)
  }

  return result
}

// 末尾/先頭のhardBreakは余分な空行になるため落とす
function trimHardBreaks(nodes: ProseMirrorNode[]): ProseMirrorNode[] {
  let start = 0
  let end = nodes.length
  while (start < end && nodes[start].type === 'hardBreak') start++
  while (end > start && nodes[end - 1].type === 'hardBreak') end--
  return nodes.slice(start, end)
}

function renderInline(nodes: ProseMirrorNode[], atBlockStart = false): string {
  // 空テキストはマークの結合を妨げるだけなので取り除く
  const meaningful = nodes.filter((node) => node.type !== 'text' || (node.text ?? '') !== '')
  const prepared = coalesceTextNodes(trimHardBreaks(meaningful))
  let result = ''
  let atLineStart = atBlockStart
  for (let index = 0; index < prepared.length; index++) {
    const node = prepared[index]
    const isStart = atLineStart
    // 行頭とみなせるのはブロック先頭とhardBreak直後だけ
    atLineStart = false
    switch (node.type) {
      case 'attachmentBadge': {
        result += renderAttachmentBadge(node)
        break
      }

      case 'documentMention': {
        result += renderDocumentMention(node)
        break
      }

      case 'hardBreak': {
        result += '  \n'
        atLineStart = true
        break
      }

      case 'image': {
        result += renderImage(node)
        break
      }

      case 'issueMention': {
        result += renderIssueMention(node)
        break
      }

      case 'text': {
        // 連続するテキストはまとめて処理し、共通マークを1度だけ適用する
        let end = index
        while (end + 1 < prepared.length && prepared[end + 1].type === 'text') end++
        result += renderTextRun(prepared.slice(index, end + 1), isStart)
        index = end
        break
      }

      default: {
        result += renderInline(childNodes(node), isStart)
      }
    }
  }

  return result
}

function renderImage(node: ProseMirrorNode): string {
  const src = attrString(node, 'src') ?? ''
  const alt = escapeBracketText(attrString(node, 'alt') ?? '')
  const title = attrString(node, 'title')
  const destination = linkDestination(src)
  return title ? `![${alt}](${destination} "${title}")` : `![${alt}](${destination})`
}

// Backlog独自ノード。attrsの形が公開されていないため、ラベルになりうるキーを順に探す
function renderAttachmentBadge(node: ProseMirrorNode): string {
  const label =
    attrString(node, 'name') ??
    attrString(node, 'title') ??
    attrString(node, 'fileName') ??
    attrString(node, 'text') ??
    renderInline(childNodes(node))
  const src = attrString(node, 'src') ?? attrString(node, 'href') ?? attrString(node, 'url')
  const resolved = escapeBracketText(label.length > 0 ? label : '添付ファイル')
  return src ? `[${resolved}](${linkDestination(src)})` : resolved
}

// Backlog独自ノード。attrsにのみ値を持ち子ノードが無いためリンクに組み立てる
function renderDocumentMention(node: ProseMirrorNode): string {
  const label =
    attrString(node, 'label') ?? attrString(node, 'title') ?? attrString(node, 'text') ?? renderInline(childNodes(node))
  const url = attrString(node, 'url') ?? attrString(node, 'href')
  const resolved = escapeBracketText(label.length > 0 ? label : 'ドキュメント')
  return url ? `[${resolved}](${linkDestination(url)})` : resolved
}

// Backlog独自ノード。課題キーを持つキーを順に探す
function renderIssueMention(node: ProseMirrorNode): string {
  const key =
    attrString(node, 'issueKey') ??
    attrString(node, 'key') ??
    attrString(node, 'label') ??
    attrString(node, 'text') ??
    renderInline(childNodes(node))
  return key
}

function renderCodeBlock(node: ProseMirrorNode): string {
  const language = attrString(node, 'language')
  // Backlogは言語未指定を"auto"として返す
  const info = language && language !== 'auto' ? language : ''
  const code = childNodes(node)
    .map((child) => (typeof child.text === 'string' ? child.text : ''))
    .join('')
  // 内容に含まれるバッククォート連より長いフェンスにしてブロックが途中で閉じるのを防ぐ
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1))
  return `${fence}${info}\n${code}\n${fence}`
}

function renderBlockquote(node: ProseMirrorNode): string {
  return renderBlocks(childNodes(node))
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')
}

// チェックボックス記法の継続行はリスト記号"- "の幅で字下げする。
// マーカー全長(6桁)だとCommonMarkがコードブロックと解釈しネストが壊れる
const TASK_ITEM_INDENT = 2

function renderListItem(node: ProseMirrorNode, marker: string, indentWidth = marker.length): string {
  const children = childNodes(node)
  const rendered = children.map((child) => (isListNode(child) ? renderList(child) : renderBlock(child)))

  let body = ''
  for (const [index, block] of rendered.entries()) {
    if (block === '') continue
    if (body === '') {
      body = block
      continue
    }

    // 段落直後のネストリストはtight listとして1改行で繋ぐ
    body += isListNode(children[index]) ? `\n${block}` : `\n\n${block}`
  }

  if (body === '') return marker.trimEnd()

  const indent = ' '.repeat(indentWidth)
  return body
    .split('\n')
    .map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
    .join('\n')
}

function taskMarker(item: ProseMirrorNode): string {
  return item.attrs?.checked === true ? '- [x] ' : '- [ ] '
}


function renderList(node: ProseMirrorNode): string {
  if (node.type === 'taskList') {
    return childNodes(node)
      .map((item) => renderListItem(item, taskMarker(item), TASK_ITEM_INDENT))
      .join('\n')
  }

  const ordered = node.type === 'orderedList'
  const startAttr = node.attrs?.start
  const start = ordered && typeof startAttr === 'number' && Number.isInteger(startAttr) ? startAttr : 1

  return childNodes(node)
    .map((item, index) => renderListItem(item, ordered ? `${start + index}. ` : '- '))
    .join('\n')
}

function renderCell(node: ProseMirrorNode): string {
  return childNodes(node)
    .map((child) => renderBlock(child))
    .filter((block) => block !== '')
    .join('<br>')
    .replaceAll(/ {0,2}\n/g, '<br>')
    .replaceAll('|', String.raw`\|`)
}

function renderTable(node: ProseMirrorNode): string {
  const rows = childNodes(node).filter((row) => row.type === 'tableRow' || childNodes(row).length > 0)
  if (rows.length === 0) return ''

  const cellRows = rows.map((row) => childNodes(row))
  const columnCount = Math.max(...cellRows.map((cells) => cells.length))
  if (columnCount === 0) return ''

  const lines = cellRows.map((cells) => {
    const rendered = cells.map((cell) => renderCell(cell))
    while (rendered.length < columnCount) rendered.push('')
    return `| ${rendered.join(' | ')} |`
  })

  // 1行目がtableHeaderでなくてもGitHub Markdownとして描画されるよう区切り行を必ず入れる
  const separator = `| ${Array.from({length: columnCount}, () => '---').join(' | ')} |`
  return [lines[0], separator, ...lines.slice(1)].join('\n')
}

function renderBlock(node: ProseMirrorNode): string {
  switch (node.type) {
    case 'blockquote': {
      return renderBlockquote(node)
    }

    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      return renderList(node)
    }

    case 'codeBlock': {
      return renderCodeBlock(node)
    }

    case 'heading': {
      const levelAttr = node.attrs?.level
      const level = typeof levelAttr === 'number' && levelAttr >= 1 && levelAttr <= 6 ? Math.trunc(levelAttr) : 1
      const inline = renderInline(childNodes(node))
      return inline === '' ? '' : `${'#'.repeat(level)} ${inline}`
    }

    case 'horizontalRule': {
      return '---'
    }

    case 'image': {
      return renderImage(node)
    }

    case 'paragraph': {
      return renderInline(childNodes(node), true)
    }

    case 'table': {
      return renderTable(node)
    }

    default: {
      const children = childNodes(node)
      if (children.length === 0) return renderInline([node], true)
      // 未知のブロックは内容を落とさずそのまま連結する
      return children.some((child) => isBlockLike(child)) ? renderBlocks(children) : renderInline(children, true)
    }
  }
}

function renderBlocks(nodes: ProseMirrorNode[]): string {
  return nodes
    .map((node) => renderBlock(node))
    .filter((block) => block !== '')
    .join('\n\n')
}

export function convertDocumentJsonToMarkdown(json: unknown): string {
  if (!isNode(json)) return ''
  const blocks = json.type === 'doc' ? childNodes(json) : [json]
  return renderBlocks(blocks)
}
