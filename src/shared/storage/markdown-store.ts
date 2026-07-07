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

export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath)
}
