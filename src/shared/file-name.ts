export function sanitizeFileName(name: string): string {
  return name
    .replaceAll(/[\\/:*?"<>|]/g, '_') // Windowsで使用できない文字を置換
    .replaceAll(/\s+/g, '_') // スペースをアンダースコアに置換
    .replaceAll('.', '_') // ドットを置換
    .slice(0, 200) // 長すぎるファイル名を防ぐために200文字に制限
}

export function sanitizeWikiFileName(name: string): string {
  const invalidChars = ['\\', ':', '*', '?', '"', '<', '>', '|']
  let sanitizedName = name
  for (const char of invalidChars) {
    sanitizedName = sanitizedName.replaceAll(char, '_')
  }

  return sanitizedName
}
