import {Logger} from '../ports.js'

export const stubLogger: Logger = {
  log() {},
  warn() {},
}

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
