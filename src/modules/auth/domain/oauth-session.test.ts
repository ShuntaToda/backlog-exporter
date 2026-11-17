import {describe, expect, it} from 'vitest'

import {
  authorizationCodeGrant,
  needsRefresh,
  parseOAuthSession,
  refreshTokenGrant,
  tokenFromResponse,
} from './oauth-session.js'

const NOW = Date.parse('2026-01-01T00:00:00Z')
const CLIENT = {clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'http://localhost:5033/callback'}

// トークンエンドポイントが返すJSONの本文（キーはBacklogの仕様どおりスネークケース）
const TOKEN_BODY = '{"access_token":"access","expires_in":3600,"refresh_token":"refresh","token_type":"Bearer"}'
const tokenBody = (fields: Record<string, unknown> = {}): unknown => ({...JSON.parse(TOKEN_BODY), ...fields})

const tokenExpiringIn = (ms: number) => ({
  accessToken: 'a',
  expiresAt: new Date(NOW + ms).toISOString(),
  refreshToken: 'r',
})

describe('tokenFromResponse', () => {
  it('expires_in（秒）から期限の日時を求めること', () => {
    const token = tokenFromResponse(tokenBody(), NOW)

    expect(token).to.deep.equal({accessToken: 'access', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'refresh'})
  })

  it('リフレッシュトークンが無いレスポンスはエラーにすること', () => {
    expect(() => tokenFromResponse(tokenBody(Object.fromEntries([['refresh_token', '']])), NOW)).to.throw(
      'リフレッシュトークン',
    )
  })

  it('expires_inが数でないレスポンスはエラーにすること', () => {
    expect(() => tokenFromResponse(tokenBody(Object.fromEntries([['expires_in', 'one hour']])), NOW)).to.throw()
  })
})

describe('tokenFromResponse - 形の確認', () => {
  it('オブジェクトでない本文はエラーにすること', () => {
    expect(() => tokenFromResponse('ok', NOW)).to.throw('アクセストークン')
    expect(() => tokenFromResponse(null, NOW)).to.throw('アクセストークン')
  })
})

describe('parseOAuthSession', () => {
  const SESSION = {
    client: {clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'},
    domain: 'example.backlog.jp',
    token: {accessToken: 'a', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'r'},
  }

  it('すべての項目がそろっていれば読み取ること', () => {
    expect(parseOAuthSession(SESSION)).to.deep.equal(SESSION)
  })

  it('トークンが欠けていればundefinedを返すこと', () => {
    expect(parseOAuthSession({...SESSION, token: {accessToken: 'a', expiresAt: 'x'}})).to.be.undefined
  })

  it('Client Secretが空ならundefinedを返すこと', () => {
    expect(parseOAuthSession({...SESSION, client: {...SESSION.client, clientSecret: ''}})).to.be.undefined
  })

  it('オブジェクトでなければundefinedを返すこと', () => {
    expect(parseOAuthSession([])).to.be.undefined
    expect(parseOAuthSession('session')).to.be.undefined
  })
})

describe('needsRefresh', () => {
  it('期限まで1分より長く残っていれば更新しないこと', () => {
    expect(needsRefresh(tokenExpiringIn(60_001), NOW)).to.be.false
  })

  it('残りが1分以下なら更新すること', () => {
    expect(needsRefresh(tokenExpiringIn(60_000), NOW)).to.be.true
  })

  it('期限切れなら更新すること', () => {
    expect(needsRefresh(tokenExpiringIn(-1), NOW)).to.be.true
  })

  it('期限を読めないときは更新すること', () => {
    expect(needsRefresh({accessToken: 'a', expiresAt: 'invalid', refreshToken: 'r'}, NOW)).to.be.true
  })
})

describe('トークンエンドポイントのパラメーター', () => {
  it('認可コードの交換にはリダイレクトURIとClient ID/Secretを含めること', () => {
    expect([...authorizationCodeGrant(CLIENT, 'the-code')]).to.deep.equal([
      ['grant_type', 'authorization_code'],
      ['code', 'the-code'],
      ['redirect_uri', 'http://localhost:5033/callback'],
      ['client_id', 'client-id'],
      ['client_secret', 'client-secret'],
    ])
  })

  it('トークンの更新にはリフレッシュトークンとClient ID/Secretを含めること', () => {
    expect([...refreshTokenGrant(CLIENT, 'the-refresh')]).to.deep.equal([
      ['grant_type', 'refresh_token'],
      ['refresh_token', 'the-refresh'],
      ['client_id', 'client-id'],
      ['client_secret', 'client-secret'],
    ])
  })
})
