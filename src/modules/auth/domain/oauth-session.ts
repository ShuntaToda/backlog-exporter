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

// 保存するアプリケーションの情報。Client Secret を 1Password などに置きたい人のために、Secret は保存しないこともできる
export interface SavedOAuthClient {
  clientId: string
  clientSecret?: string
  redirectUri: string
}

// 1つのBacklogスペースに対するログイン状態。トークンの更新にClient IDが要るため一緒に持つ
export interface OAuthSession {
  client: SavedOAuthClient
  domain: string
  token: OAuthToken
}

export function sessionToSave(
  options: {client: OAuthClient; domain: string; token: OAuthToken},
  saveClientSecret: boolean,
): OAuthSession {
  const {client, domain, token} = options
  const {clientSecret, ...withoutSecret} = client
  return {client: saveClientSecret ? {...withoutSecret, clientSecret} : withoutSecret, domain, token}
}

// 環境変数の値を優先する（1Password の op run などで渡された最新の Secret を使うため）。どちらにも無ければ undefined
export function clientSecretForRefresh(session: OAuthSession, envClientSecret?: string): string | undefined {
  return envClientSecret || session.client.clientSecret
}

// 期限ちょうどに送ると途中で切れるため、残りがこの時間を切ったら先に更新する
const REFRESH_MARGIN_MS = 60_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

// トークンエンドポイントのレスポンス（https://developer.nulab.com/ja/docs/backlog/auth/）。外から来る値なので形を確かめる
export function tokenFromResponse(response: unknown, nowMs: number): OAuthToken {
  const accessToken = isRecord(response) ? nonEmptyString(response.access_token) : undefined
  const refreshToken = isRecord(response) ? nonEmptyString(response.refresh_token) : undefined
  const expiresIn = isRecord(response) ? response.expires_in : undefined
  if (!accessToken || !refreshToken || typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) {
    throw new Error(
      'トークンエンドポイントのレスポンスにアクセストークン・リフレッシュトークン・有効期限が含まれていません',
    )
  }

  return {accessToken, expiresAt: new Date(nowMs + expiresIn * 1000).toISOString(), refreshToken}
}

// 保存したログイン情報は手で書き換えられることもあるため、使う前に形を確かめる。足りなければundefined
export function parseOAuthSession(value: unknown): OAuthSession | undefined {
  if (!isRecord(value) || !isRecord(value.client) || !isRecord(value.token)) return undefined
  const domain = nonEmptyString(value.domain)
  const clientId = nonEmptyString(value.client.clientId)
  // Secret を保存しない選択をした場合は項目ごと無い
  const clientSecret = nonEmptyString(value.client.clientSecret)
  const redirectUri = nonEmptyString(value.client.redirectUri)
  const accessToken = nonEmptyString(value.token.accessToken)
  const expiresAt = nonEmptyString(value.token.expiresAt)
  const refreshToken = nonEmptyString(value.token.refreshToken)
  if (!domain || !clientId || !redirectUri || !accessToken || !expiresAt || !refreshToken) {
    return undefined
  }

  const client = clientSecret ? {clientId, clientSecret, redirectUri} : {clientId, redirectUri}
  return {client, domain, token: {accessToken, expiresAt, refreshToken}}
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

export function refreshTokenGrant(
  client: {clientId: string; clientSecret: string},
  refreshToken: string,
): URLSearchParams {
  return new URLSearchParams([
    ['grant_type', 'refresh_token'],
    ['refresh_token', refreshToken],
    ['client_id', client.clientId],
    ['client_secret', client.clientSecret],
  ])
}
