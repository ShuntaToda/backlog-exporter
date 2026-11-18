import {BacklogAuth} from '../../../shared/backlog/auth.js'
import {Logger} from '../../../shared/ports.js'
import {
  clientSecretForRefresh,
  needsRefresh,
  OAuthSession,
  OAuthToken,
  refreshTokenGrant,
} from '../domain/oauth-session.js'

export interface OAuthAuthDeps {
  logger: Logger
  now: () => number
  readClientSecretFromEnv: () => string | undefined
  requestToken: (domain: string, grant: URLSearchParams, nowMs: number) => Promise<OAuthToken>
  saveSession: (session: OAuthSession) => Promise<void>
}

// アクセストークンは1時間で切れるため、期限が近いとき・401を受けたときにリフレッシュトークンで更新する
export function createOAuthAuth(deps: OAuthAuthDeps, session: OAuthSession): BacklogAuth {
  let current = session
  // 同時に送ったリクエストが揃って期限切れを検知しても、更新は1回にまとめる
  let refreshing: Promise<void> | undefined

  const refresh = (): Promise<void> => {
    refreshing ??= (async () => {
      const clientSecret = clientSecretForRefresh(current, deps.readClientSecretFromEnv())
      if (!clientSecret) {
        // 再ログインでは解決しないため、更新の失敗とは分けて案内する
        throw new Error(
          'トークンの更新に Client Secret が必要です。BACKLOG_OAUTH_CLIENT_SECRET を設定してください（1Password を使う場合は op run 経由で実行してください）',
        )
      }

      let token: OAuthToken
      try {
        token = await deps.requestToken(
          current.domain,
          refreshTokenGrant({clientId: current.client.clientId, clientSecret}, current.token.refreshToken),
          deps.now(),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(
          `OAuthのトークンを更新できませんでした。backlog-exporter login で再度ログインしてください（${message}）`,
        )
      }

      current = {...current, token}
      // 更新でリフレッシュトークンも新しくなるため、次回の実行に引き継ぐ。
      // 保存に失敗しても手元のトークンは有効なので、今回の実行は続ける（古いリフレッシュトークンは使えなくなっている）
      try {
        await deps.saveSession(current)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        deps.logger.warn(
          `更新したトークンを保存できませんでした。次回の実行では backlog-exporter login で再度ログインしてください（${message}）`,
        )
      }
    })().finally(() => {
      refreshing = undefined
    })
    return refreshing
  }

  return {
    async credentials() {
      if (needsRefresh(current.token, deps.now())) await refresh()
      return {headers: {authorization: `Bearer ${current.token.accessToken}`}, query: {}}
    },
    recoverFromUnauthorized: refresh,
  }
}
