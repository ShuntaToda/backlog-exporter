import {backlogOrigin} from '../../../shared/backlog-url.js'
import {OAuthClient} from './oauth-session.js'

export const DEFAULT_REDIRECT_URI = 'http://localhost:5033/callback'

// 認可コードは手元で立てたサーバで受け取るため、リダイレクト先は自分のマシンのポートに限る
export interface LoopbackRedirect {
  hostname: string
  pathname: string
  port: number
}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost'])

export function parseLoopbackRedirectUri(redirectUri: string): LoopbackRedirect {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    throw new Error(`リダイレクトURIの形式が正しくありません: ${redirectUri}`)
  }

  if (url.protocol !== 'http:' || !LOOPBACK_HOSTNAMES.has(url.hostname)) {
    throw new Error(
      `リダイレクトURIは http://localhost:<ポート>/... または http://127.0.0.1:<ポート>/... にしてください: ${redirectUri}`,
    )
  }

  if (!url.port) {
    throw new Error(`リダイレクトURIにはポート番号を指定してください: ${redirectUri}`)
  }

  return {hostname: url.hostname, pathname: url.pathname, port: Number(url.port)}
}

// https://developer.nulab.com/ja/docs/backlog/auth/ の認可リクエスト
export function buildAuthorizationUrl(domain: string, client: OAuthClient, state: string): string {
  const params = new URLSearchParams([
    ['response_type', 'code'],
    ['client_id', client.clientId],
    ['redirect_uri', client.redirectUri],
    ['state', state],
  ])
  return `${backlogOrigin(domain)}/OAuth2AccessRequest.action?${params.toString()}`
}

// 認可エンドポイントからのリダイレクトを読む。stateが違うものは別の画面から送られた可能性があるため受け付けない
export function readAuthorizationCallback(callbackUrl: URL, expectedState: string): string {
  const error = callbackUrl.searchParams.get('error')
  if (error) {
    const description = callbackUrl.searchParams.get('error_description')
    throw new Error(`Backlogでアクセスが許可されませんでした: ${description ? `${error} (${description})` : error}`)
  }

  if (callbackUrl.searchParams.get('state') !== expectedState) {
    throw new Error('認可レスポンスのstateが一致しません。もう一度 login を実行してください')
  }

  const code = callbackUrl.searchParams.get('code')
  if (!code) {
    throw new Error('認可レスポンスに認可コードが含まれていません')
  }

  return code
}
