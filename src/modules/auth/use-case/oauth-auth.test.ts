import {describe, expect, it} from 'vitest'

import {createRecordingLogger} from '../../../shared/testing/stub-logger.js'
import {OAuthSession, OAuthToken} from '../domain/oauth-session.js'
import {createOAuthAuth} from './oauth-auth.js'

const NOW = Date.parse('2026-01-01T00:00:00Z')

const session = (expiresInMs: number): OAuthSession => ({
  client: {clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'},
  domain: 'example.backlog.jp',
  token: {accessToken: 'old-access', expiresAt: new Date(NOW + expiresInMs).toISOString(), refreshToken: 'old-refresh'},
})

const newToken: OAuthToken = {
  accessToken: 'new-access',
  expiresAt: '2026-01-01T01:00:00.000Z',
  refreshToken: 'new-refresh',
}

function fakes(
  requestToken: () => Promise<OAuthToken> = async () => newToken,
  saveSession: (session: OAuthSession) => Promise<void> = async () => {},
) {
  const grants: URLSearchParams[] = []
  const saved: OAuthSession[] = []
  const logger = createRecordingLogger()
  return {
    deps: {
      logger,
      now: () => NOW,
      async requestToken(_domain: string, grant: URLSearchParams) {
        grants.push(grant)
        return requestToken()
      },
      async saveSession(s: OAuthSession) {
        saved.push(s)
        await saveSession(s)
      },
    },
    grants,
    logger,
    saved,
  }
}

describe('createOAuthAuth', () => {
  it('期限まで余裕があれば今のアクセストークンをBearerで送ること', async () => {
    const {deps, grants} = fakes()
    const auth = createOAuthAuth(deps, session(30 * 60_000))

    expect(await auth.credentials()).to.deep.equal({headers: {authorization: 'Bearer old-access'}, query: {}})
    expect(grants).to.have.length(0)
  })

  it('期限が近ければ先に更新し、新しいトークンを保存すること', async () => {
    const {deps, grants, saved} = fakes()
    const auth = createOAuthAuth(deps, session(30_000))

    expect((await auth.credentials()).headers.authorization).to.equal('Bearer new-access')
    expect(grants[0].get('refresh_token')).to.equal('old-refresh')
    expect(saved).to.have.length(1)
    expect(saved[0].token).to.deep.equal(newToken)
  })

  it('同時に期限切れを検知しても更新は1回にまとめること', async () => {
    const {deps, grants} = fakes()
    const auth = createOAuthAuth(deps, session(-1))

    await Promise.all([auth.credentials(), auth.credentials(), auth.credentials()])

    expect(grants).to.have.length(1)
  })

  it('401からの回復ではトークンを更新し、次の更新には新しいリフレッシュトークンを使うこと', async () => {
    const {deps, grants} = fakes()
    const auth = createOAuthAuth(deps, session(30 * 60_000))

    await auth.recoverFromUnauthorized!()
    await auth.recoverFromUnauthorized!()

    expect(grants.map((grant) => grant.get('refresh_token'))).to.deep.equal(['old-refresh', 'new-refresh'])
  })

  it('更新に失敗したら再ログインを促すこと', async () => {
    const {deps, saved} = fakes(async () => {
      throw new Error('HTTP 400 invalid_grant')
    })
    const auth = createOAuthAuth(deps, session(-1))

    await expect(auth.credentials()).rejects.toThrow('backlog-exporter login')
    expect(saved).to.have.length(0)
  })

  it('更新したトークンを保存できなくても今回の実行は続け、次回の再ログインを案内すること', async () => {
    const {deps, logger} = fakes(undefined, async () => {
      throw new Error('EACCES')
    })
    const auth = createOAuthAuth(deps, session(-1))

    expect((await auth.credentials()).headers.authorization).to.equal('Bearer new-access')
    expect(logger.warnings.join('\n')).to.include('backlog-exporter login')
  })
})
