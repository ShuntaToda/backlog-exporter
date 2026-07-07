import process from 'node:process'

export function loadDotenv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env が存在しない場合は何もしない
  }
}

export function resolveApiKey(provided?: string, onEnvUsed?: () => void): string | undefined {
  if (provided) {
    return provided
  }

  const envApiKey = process.env.BACKLOG_API_KEY
  if (envApiKey) {
    onEnvUsed?.()
    return envApiKey
  }

  return undefined
}

export const API_KEY_NOT_FOUND_MESSAGE =
  'APIキーが見つかりません。--apiKey フラグまたは BACKLOG_API_KEY 環境変数で提供してください'
