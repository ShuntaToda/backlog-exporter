import * as fs from 'node:fs/promises'
import path from 'node:path'

import {ExpectedPaths} from '../../domain/file-naming.js'
import {appendLog} from './update-log.js'

/**
 * ディレクトリを作成する（存在する場合は何もしない）
 */
export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, {recursive: true})
}

/**
 * ファイルの存在を確認する
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  )
}

/**
 * Markdownファイルを書き込む（親ディレクトリが無ければ作成する）
 */
export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true})
  await fs.writeFile(filePath, content)
}

/**
 * ファイルを削除する
 */
export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath)
}

/**
 * ローカルディレクトリを再帰的に走査し、期待パス集合に含まれない .md ファイルと空ディレクトリを削除する。
 *
 * 削除対象は .md ファイルのみで、backlog-settings.json・backlog-update.log・
 * ユーザーが置いた他ファイルには触れない。
 * 比較は macOSのファイルシステム(NFD)とAPIレスポンス(NFC)のUnicode正規化差異を吸収するためNFCに揃える。
 * また、macOS/Windowsの大文字小文字を区別しないファイルシステムでは、Backlog上で大文字小文字のみ
 * 変更されたタイトルでもディスク上のエントリ名が旧表記のまま残るため、小文字に揃えて比較する
 * （大文字小文字を区別するファイルシステムでは旧表記のファイルが残り得るが、誤削除よりも安全側に倒す）。
 *
 * @returns 削除したファイル数
 */
export async function pruneLocalMarkdownFiles(options: {
  expected: ExpectedPaths
  /** メッセージに埋め込む種別ラベル（例: 「ドキュメント」「Wiki」） */
  label: string
  log: (message: string) => void
  outputDir: string
}): Promise<number> {
  const expectedFilesComparable = new Set([...options.expected.expectedFiles].map((p) => p.toLowerCase()))
  const expectedDirsComparable = new Set([...options.expected.expectedDirs].map((p) => p.toLowerCase()))
  let prunedCount = 0

  const pruneDirectory = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, {withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(options.outputDir, fullPath).normalize('NFC')
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await pruneDirectory(fullPath)

        // 空になったディレクトリを削除（Backlog上に存在するディレクトリは残す）
        // eslint-disable-next-line no-await-in-loop
        const remaining = await fs.readdir(fullPath)
        if (remaining.length === 0 && !expectedDirsComparable.has(relativePath.toLowerCase())) {
          // eslint-disable-next-line no-await-in-loop
          await fs.rmdir(fullPath)
          options.log(`空のディレクトリを削除しました: ${relativePath}`)
        }
      } else if (entry.name.endsWith('.md') && !expectedFilesComparable.has(relativePath.toLowerCase())) {
        // eslint-disable-next-line no-await-in-loop
        await fs.unlink(fullPath)
        prunedCount++
        options.log(`Backlog上に存在しない${options.label}を削除しました: ${relativePath}`)
        // eslint-disable-next-line no-await-in-loop
        await appendLog(options.outputDir, `${options.label}「${relativePath}」を削除しました（Backlog上に存在しないため）`)
      }
    }
  }

  await pruneDirectory(options.outputDir)
  options.log(`${prunedCount}件の不要な${options.label}ファイルを削除しました。`)
  return prunedCount
}
