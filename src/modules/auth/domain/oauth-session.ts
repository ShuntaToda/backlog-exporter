// Backlog Developerサイトで利用者が登録したアプリケーション
export interface OAuthClient {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface OAuthToken {
  accessToken: string
  expiresAt: string
  refreshToken: string
}

// 1つのBacklogスペースに対するログイン状態。トークンの更新にClient ID/Secretが要るため一緒に持つ
export interface OAuthSession {
  client: OAuthClient
  domain: string
  token: OAuthToken
}

// トークンエンドポイントのレスポンス（https://developer.nulab.com/ja/docs/backlog/auth/）
export interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
}

// 期限ちょうどに送ると途中で切れるため、残りがこの時間を切ったら先に更新する
const REFRESH_MARGIN_MS = 60_000

export function tokenFromResponse(response: TokenResponse, nowMs: number): OAuthToken {
  if (!response.access_token || !response.refresh_token || !Number.isFinite(response.expires_in)) {
    throw new Error('トークンエンドポイントのレスポンスにアクセストークンまたはリフレッシュトークンが含まれていません')
  }

  return {
    accessToken: response.access_token,
    expiresAt: new Date(nowMs + response.expires_in * 1000).toISOString(),
    refreshToken: response.refresh_token,
  }
}

export function needsRefresh(token: OAuthToken, nowMs: number): boolean {
  const expiresAtMs = Date.parse(token.expiresAt)
  // 読めない期限は切れているものとして扱い、更新で正しい値に戻す
  if (Number.isNaN(expiresAtMs)) return true
  return expiresAtMs - nowMs <= REFRESH_MARGIN_MS
}

// パラメーター名はBacklogのトークンエンドポイントの仕様（スネークケース）に合わせる
export function authorizationCodeGrant(client: OAuthClient, code: string): URLSearchParams {
  return new URLSearchParams([
    ['grant_type', 'authorization_code'],
    ['code', code],
    ['redirect_uri', client.redirectUri],
    ['client_id', client.clientId],
    ['client_secret', client.clientSecret],
  ])
}

export function refreshTokenGrant(client: OAuthClient, refreshToken: string): URLSearchParams {
  return new URLSearchParams([
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
    ['client_id', client.clientId],
    ['client_secret', client.clientSecret],
  ])
}
