import {describe, expect, it} from 'vitest'

import {createRecordingLogger} from '../../../shared/testing/stub-logger.js'
import {OAuthSession, OAuthToken} from '../domain/oauth-session.js'
import {login, LoginDeps} from './login.js'

const NOW = Date.parse('2026-01-01T00:00:00Z')
const CLIENT = {clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'}
const TOKEN: OAuthToken = {accessToken: 'access', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'refresh'}

function fakeDeps(options: {browserOpens?: boolean; callbackQuery: string}) {
  const calls = {closed: 0, grants: [] as URLSearchParams[], opened: [] as string[], saved: [] as OAuthSession[]}
  const logger = createRecordingLogger()
  const deps: LoginDeps = {
    generateState: () => 'the-state',
    async listenForCallback() {
      return {
        callbackUrl: Promise.resolve(new URL(`http://localhost:5033/callback?${options.callbackQuery}`)),
        async close() {
          calls.closed++
        },
      }
    },
    logger,
    now: () => NOW,
    async openBrowser(url) {
      calls.opened.push(url)
      return options.browserOpens ?? true
    },
    async requestToken(_domain, grant) {
      calls.grants.push(grant)
      return TOKEN
    },
    async saveSession(session) {
      calls.saved.push(session)
    },
  }
  return {calls, deps, warnings: logger.warnings}
}

describe('login', () => {
  it('許可画面を開き、受け取った認可コードをトークンに換えて保存すること', async () => {
    const {calls, deps} = fakeDeps({callbackQuery: 'code=the-code&state=the-state'})

    await login(deps, {client: CLIENT, domain: 'example.backlog.jp'})

    expect(new URL(calls.opened[0]).searchParams.get('state')).to.equal('the-state')
    expect(calls.grants[0].get('code')).to.equal('the-code')
    expect(calls.saved).to.deep.equal([{client: CLIENT, domain: 'example.backlog.jp', token: TOKEN}])
    expect(calls.closed).to.equal(1)
  })

  it('stateが違えばトークンを取りに行かず、待ち受けを閉じること', async () => {
    const {calls, deps} = fakeDeps({callbackQuery: 'code=the-code&state=forged'})

    await expect(login(deps, {client: CLIENT, domain: 'example.backlog.jp'})).rejects.toThrow('state')
    expect(calls.grants).to.have.length(0)
    expect(calls.saved).to.have.length(0)
    expect(calls.closed).to.equal(1)
  })

  it('ブラウザを開けなくても、URLを案内して待ち続けること', async () => {
    const {calls, deps, warnings} = fakeDeps({browserOpens: false, callbackQuery: 'code=c&state=the-state'})

    await login(deps, {client: CLIENT, domain: 'example.backlog.jp'})

    expect(warnings.some((message) => message.includes('手動で開いて'))).to.be.true
    expect(calls.saved).to.have.length(1)
  })

  it('リダイレクトURIが手元のマシンでなければ待ち受けを始めないこと', async () => {
    const {calls, deps} = fakeDeps({callbackQuery: ''})

    await expect(
      login(deps, {client: {...CLIENT, redirectUri: 'https://example.com/callback'}, domain: 'example.backlog.jp'}),
    ).rejects.toThrow('http://localhost')
    expect(calls.opened).to.have.length(0)
    expect(calls.closed).to.equal(0)
  })
})
