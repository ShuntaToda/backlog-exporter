import * as fs from 'node:fs/promises'
import path from 'node:path'

// backlog-update.logは監査用途のため、実行環境のロケールに依存せず日本語固定とする
export async function appendLog(outputDir: string, message: string): Promise<void> {
  const logPath = path.join(outputDir, 'backlog-update.log')
  const timestamp = new Date().toLocaleString('ja-JP')
  const logMessage = `[${timestamp}] ${message}\n`

  try {
    await fs.appendFile(logPath, logMessage, 'utf8')
  } catch (error) {
    console.error(`ログの記録に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
  }
}
