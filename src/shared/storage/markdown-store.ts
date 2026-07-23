import * as fs from 'node:fs/promises'
import path from 'node:path'

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, {recursive: true})
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  )
}

export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  await fs.writeFile(filePath, content)
}

// 中断で壊れたファイルが完成品として残らないよう、一時ファイルに書いてからrenameする
export async function writeBinaryFile(filePath: string, data: ArrayBuffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  const tempPath = `${filePath}.tmp`
  await fs.writeFile(tempPath, new Uint8Array(data))
  await fs.rename(tempPath, filePath)
}

export async function fileSize(filePath: string): Promise<null | number> {
  const stats = await fs.stat(filePath).catch(() => null)
  return stats?.size ?? null
}

export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath)
}

export async function assertDirectoryExists(directory: string): Promise<void> {
  const stats = await fs.stat(directory).catch(() => {})
  if (!stats?.isDirectory()) {
    throw new Error(`指定されたディレクトリが存在しません: ${directory}`)
  }
}
