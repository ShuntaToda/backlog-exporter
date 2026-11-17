import {BacklogAuth} from '../../../shared/backlog/auth.js'
import {Logger} from '../../../shared/ports.js'
import {needsRefresh, OAuthSession, OAuthToken, refreshTokenGrant} from '../domain/oauth-session.js'

export interface OAuthAuthDeps {
  logger: Logger
  now: () => number
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
      let token: OAuthToken
      try {
        token = await deps.requestToken(
          current.domain,
          refreshTokenGrant(current.client, current.token.refreshToken),
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
