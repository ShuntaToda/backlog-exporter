import * as fs from 'node:fs/promises'
import path from 'node:path'

import {appendLog} from '../../../shared/storage/update-log.js'
import {ExpectedPaths} from '../domain/expected-paths.js'

// 期待パス集合に含まれない .md ファイルと空ディレクトリを削除する。
// 削除対象は .md のみで、設定ファイル・ログ・ユーザーが置いた他のファイルには触れない。
// 比較はNFC正規化（macOSのNFDとAPIレスポンスのNFCの差異吸収）＋小文字化
// （大文字小文字非区別FSでは大小文字のみのリネーム後もディスク上のエントリ名が旧表記のまま残るため。
// 区別するFSでは旧表記が残り得るが、誤削除より安全側に倒す）で行う。
export async function pruneLocalMarkdownFiles(options: {
  expected: ExpectedPaths
  label: string
  log: (message: string) => void
  outputDir: string
}): Promise<number> {
  const expectedFiles = new Set([...options.expected.expectedFiles].map((p) => p.toLowerCase()))
  const expectedDirs = new Set([...options.expected.expectedDirs].map((p) => p.toLowerCase()))
  let prunedCount = 0

  /* eslint-disable no-await-in-loop */
  const pruneDirectory = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, {withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(options.outputDir, fullPath).normalize('NFC')
      if (entry.isDirectory()) {
        await pruneDirectory(fullPath)

        const remaining = await fs.readdir(fullPath)
        if (remaining.length === 0 && !expectedDirs.has(relativePath.toLowerCase())) {
          await fs.rmdir(fullPath)
          options.log(`空のディレクトリを削除しました: ${relativePath}`)
        }
      } else if (entry.name.endsWith('.md') && !expectedFiles.has(relativePath.toLowerCase())) {
        await fs.unlink(fullPath)
        prunedCount++
        options.log(`Backlog上に存在しない${options.label}を削除しました: ${relativePath}`)
        await appendLog(
          options.outputDir,
          `${options.label}「${relativePath}」を削除しました（Backlog上に存在しないため）`,
        )
      }
    }
  }
  /* eslint-enable no-await-in-loop */

  await pruneDirectory(options.outputDir)
  options.log(`${prunedCount}件の不要な${options.label}ファイルを削除しました。`)
  return prunedCount
}
