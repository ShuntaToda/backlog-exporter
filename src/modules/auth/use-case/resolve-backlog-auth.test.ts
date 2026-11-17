import process from 'node:process'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BacklogAuth} from '../../../shared/backlog/auth.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {OAuthSession} from '../domain/oauth-session.js'
import {resolveBacklogAuth} from './resolve-backlog-auth.js'

const SESSION: OAuthSession = {
  client: {clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'},
  domain: 'example.backlog.jp',
  token: {accessToken: 'access', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'refresh'},
}

const OAUTH_AUTH: BacklogAuth = {
  async credentials() {
    return {headers: {authorization: 'Bearer access'}, query: {}}
  },
}

describe('resolveBacklogAuth', () => {
  let savedEnv: string | undefined
  const loadedDomains: string[] = []

  const deps = (session?: OAuthSession) => ({
    createOAuthAuth: () => OAUTH_AUTH,
    async loadSession(domain: string) {
      loadedDomains.push(domain)
      return session
    },
    logger: stubLogger,
  })

  beforeEach(() => {
    savedEnv = process.env.BACKLOG_API_KEY
    delete process.env.BACKLOG_API_KEY
    loadedDomains.length = 0
  })

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.BACKLOG_API_KEY
    else process.env.BACKLOG_API_KEY = savedEnv
  })

  it('APIキーが指定されていればログイン済みでもAPIキーを使うこと', async () => {
    const auth = await resolveBacklogAuth(deps(SESSION), {apiKey: 'flag-key', domain: 'example.backlog.jp'})

    expect((await auth!.credentials()).query).to.deep.equal({apiKey: 'flag-key'})
    expect(loadedDomains).to.have.length(0)
  })

  it('指定が無ければ環境変数のAPIキーを使うこと', async () => {
    process.env.BACKLOG_API_KEY = 'env-key'

    const auth = await resolveBacklogAuth(deps(SESSION), {domain: 'example.backlog.jp'})

    expect((await auth!.credentials()).query).to.deep.equal({apiKey: 'env-key'})
  })

  it('APIキーが無ければそのスペースのOAuthのログイン情報を使うこと', async () => {
    const auth = await resolveBacklogAuth(deps(SESSION), {domain: 'example.backlog.jp'})

    expect(auth).to.equal(OAUTH_AUTH)
    expect(loadedDomains).to.deep.equal(['example.backlog.jp'])
  })

  it('どれも無ければundefinedを返すこと', async () => {
    expect(await resolveBacklogAuth(deps(), {domain: 'example.backlog.jp'})).to.be.undefined
  })
})
