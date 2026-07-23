export function sanitizeFileName(name: string): string {
  return name
    .replaceAll(/[\\/:*?"<>|]/g, '_') // Windowsで使用できない文字を置換
    .replaceAll(/\s+/g, '_') // スペースをアンダースコアに置換
    .replaceAll('.', '_') // ドットを置換
    .slice(0, 200) // 長すぎるファイル名を防ぐために200文字に制限
}

// 添付ファイル用: sanitizeFileNameと異なり、拡張子が消えないようドットを保持する
export function sanitizeAttachmentFileName(name: string): string {
  const sanitized = name.replaceAll(/[\\/:*?"<>|]/g, '_').replaceAll(/\s+/g, '_')
  if (sanitized.length <= 200) return sanitized

  const dotIndex = sanitized.lastIndexOf('.')
  const extension = dotIndex > 0 ? sanitized.slice(dotIndex) : ''
  if (extension.length === 0 || extension.length >= 200) return sanitized.slice(0, 200)

  return sanitized.slice(0, 200 - extension.length) + extension
}

export function sanitizeWikiFileName(name: string): string {
  const invalidChars = ['\\', ':', '*', '?', '"', '<', '>', '|']
  let sanitizedName = name
  for (const char of invalidChars) {
    sanitizedName = sanitizedName.replaceAll(char, '_')
  }

  return sanitizedName
}
