import {homedir} from 'node:os'
import {join} from 'node:path'
import process from 'node:process'

export function loadDotenv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env が存在しない場合は何もしない
  }
}

export function readApiKeyFromEnv(): string | undefined {
  return process.env.BACKLOG_API_KEY || undefined
}

// 出力先ごとの backlog-settings.json はリポジトリに入れられることがあるため、ログイン情報は利用者の設定ディレクトリに分けて置く
export function configDirectory(): string {
  if (process.env.BACKLOG_EXPORTER_CONFIG_DIR) return process.env.BACKLOG_EXPORTER_CONFIG_DIR
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(base, 'backlog-exporter')
}
