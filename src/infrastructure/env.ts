import process from 'node:process'

/**
 * カレントディレクトリの .env ファイルを読み込む（存在しない場合は何もしない）。
 * dotenvパッケージの代替として Node.js 組み込みの process.loadEnvFile を使う。
 */
export function loadDotenv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env が存在しない場合は何もしない
  }
}

/**
 * APIキーを解決する（優先順位: 明示指定 > 環境変数 BACKLOG_API_KEY）
 * @param provided コマンドラインフラグ等で明示指定されたAPIキー
 * @param onEnvUsed 環境変数からAPIキーを使用したときに呼ばれるコールバック（ユーザーへの通知用）
 * @returns APIキー（見つからない場合は undefined）
 */
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

/** APIキーが見つからないときのエラーメッセージ */
export const API_KEY_NOT_FOUND_MESSAGE =
  'APIキーが見つかりません。--apiKey フラグまたは BACKLOG_API_KEY 環境変数で提供してください'
