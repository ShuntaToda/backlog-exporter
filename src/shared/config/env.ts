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

// login で Client Secret を保存しなかった場合に、トークンの更新で使う
export function readClientSecretFromEnv(): string | undefined {
  return process.env.BACKLOG_OAUTH_CLIENT_SECRET || undefined
}

// 出力先ごとの backlog-settings.json はリポジトリに入れられることがあるため、ログイン情報は利用者の設定ディレクトリに分けて置く。
// Windows では %APPDATA% が移動プロファイルで他のPCへ同期されることがあるため、そのPCだけに残る %LOCALAPPDATA% を使う
export function configDirectory(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (env.BACKLOG_EXPORTER_CONFIG_DIR) return env.BACKLOG_EXPORTER_CONFIG_DIR
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'backlog-exporter')
  if (platform === 'win32' && env.LOCALAPPDATA) return join(env.LOCALAPPDATA, 'backlog-exporter')
  return join(homedir(), '.config', 'backlog-exporter')
}
