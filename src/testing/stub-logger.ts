import {Logger} from '../usecases/ports.js'

/**
 * テスト用のロガースタブ（出力を捨てる）
 */
export const stubLogger: Logger = {
  log() {},
  warn() {},
}

/**
 * 警告メッセージを記録するロガースタブを作る
 */
export function createRecordingLogger(): Logger & {logs: string[]; warnings: string[]} {
  const logs: string[] = []
  const warnings: string[] = []
  return {
    log(message: string) {
      logs.push(message)
    },
    logs,
    warn(message: string) {
      warnings.push(message)
    },
    warnings,
  }
}
