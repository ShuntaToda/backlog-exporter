import {apiKeyAuth, BacklogAuth} from '../../../shared/backlog/auth.js'
import {Logger} from '../../../shared/ports.js'
import {OAuthSession} from '../domain/oauth-session.js'

export interface ResolveBacklogAuthDeps {
  createOAuthAuth: (session: OAuthSession) => BacklogAuth
  loadSession: (domain: string) => Promise<OAuthSession | undefined>
  logger: Logger
  readApiKeyFromEnv: () => string | undefined
}

export const AUTH_NOT_FOUND_MESSAGE =
  '認証情報が見つかりません。--apiKey フラグか BACKLOG_API_KEY 環境変数でAPIキーを指定するか、backlog-exporter login でOAuthのログインをしてください'

// 明示されたAPIキーを最優先にし、既存の使い方（APIキー）の挙動を変えない。どれも無いときだけOAuthのログイン情報を使う
export async function resolveBacklogAuth(
  deps: ResolveBacklogAuthDeps,
  input: {apiKey?: string; domain: string},
): Promise<BacklogAuth | undefined> {
  if (input.apiKey) return apiKeyAuth(input.apiKey)

  const envApiKey = deps.readApiKeyFromEnv()
  if (envApiKey) {
    deps.logger.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します')
    return apiKeyAuth(envApiKey)
  }

  const session = await deps.loadSession(input.domain)
  if (!session) return undefined

  deps.logger.log('OAuthのログイン情報を使用します')
  return deps.createOAuthAuth(session)
}
