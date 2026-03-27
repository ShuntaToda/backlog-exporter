import * as fs from 'node:fs/promises'
import path from 'node:path'

import {t} from './i18n.js'

/**
 * 更新ログを記録する
 * @param outputDir 出力ディレクトリ
 * @param message ログメッセージ
 */
export async function appendLog(outputDir: string, message: string): Promise<void> {
  const logPath = path.join(outputDir, 'backlog-update.log')
  const timestamp = new Date().toLocaleString('ja-JP')
  const logMessage = `[${timestamp}] ${message}\n`

  try {
    await fs.appendFile(logPath, logMessage, 'utf8')
  } catch (error) {
    console.error(t('common.messages.logFailed', {errorMessage: error instanceof Error ? error.message : String(error)}))
  }
}
