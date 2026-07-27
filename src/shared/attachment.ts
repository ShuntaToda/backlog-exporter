import {sanitizeAttachmentFileName} from './file-name.js'

// 課題・Wiki・ドキュメントの添付に共通する最小フィールド
export interface AttachmentRef {
  id: number
  name: string
}

// 添付IDを前置して同名添付の衝突を防ぎ、存在チェックだけでDL済み判定できるようにする
export function attachmentFileName(attachment: AttachmentRef): string {
  return `${attachment.id}_${sanitizeAttachmentFileName(attachment.name)}`
}

// Markdownリンク先の丸括弧はインラインリンクを壊すためエンコードする
export function encodeLinkDestination(linkPath: string): string {
  return linkPath.replaceAll('(', '%28').replaceAll(')', '%29')
}

// ファイル名中の角括弧はリンク構文を壊すためエスケープする
export function escapeLinkText(name: string): string {
  return name.replaceAll('[', String.raw`\[`).replaceAll(']', String.raw`\]`)
}

// Backlogの添付画像インライン記法（Markdown拡張の ![alt][ファイル名] とBacklog記法の #image(ファイル名)）を
// ダウンロード済みファイルへのローカルリンクに変換する。未ダウンロードの参照は壊さずそのまま残す
export function rewriteInlineImages(
  text: string,
  attachments: AttachmentRef[] | undefined,
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
