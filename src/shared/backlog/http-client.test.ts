import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogMockServer} from '../testing/backlog-mock-server.js'
import {BacklogAuth} from './auth.js'
import {BacklogHttpClient, HttpError, rateLimitWaitMs} from './http-client.js'

const API_KEY = 'test-api-key'

describe('rateLimitWaitMs', () => {
  it('リセット時刻までの残り時間+1秒を返すこと', () => {
    const nowMs = 1_700_000_000_000
    expect(rateLimitWaitMs(String(1_700_000_030), nowMs)).to.equal(31_000)
  })

  it('ヘッダーが無い場合は1分を返すこと', () => {
    expect(rateLimitWaitMs(null, 0)).to.equal(60_000)
    expect(rateLimitWaitMs('invalid', 0)).to.equal(60_000)
  })

  it('過去のリセット時刻は最小1秒に丸めること', () => {
    expect(rateLimitWaitMs('1000', 1_700_000_000_000)).to.equal(1000)
  })

  it('異常に先のリセット時刻は最大2分に丸めること', () => {
    const nowMs = 1_700_000_000_000
    expect(rateLimitWaitMs(String(1_700_000_000 + 600), nowMs)).to.equal(120_000)
  })
})

describe('BacklogHttpClient', () => {
  const server = new BacklogMockServer()

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(() => server.reset())

  const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: server.domain})

  it('apiKeyを自動で付与してJSONを取得すること', async () => {
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})

    const result = await client().getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
    expect(server.requests[0].searchParams.get('apiKey')).to.equal(API_KEY)
  })

  it('一時的な5xxエラーをリトライして成功すること', async () => {
    server.respondOnce('/api/v2/projects/TEST', {status: 500})
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})

    const result = await client().getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
    expect(server.requests).to.have.length(2)
  })

  it('リトライ上限を超えた5xxエラーはHttpErrorとしてスローすること', async () => {
    server.respond('/api/v2/projects/TEST', {status: 500})

    try {
      await client().getJson('/projects/TEST')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(500)
    }

    // 初回 + リトライ2回
    expect(server.requests).to.have.length(3)
  })

  it('404はリトライせず即座にHttpErrorをスローすること', async () => {
    try {
      await client().getJson('/projects/NONE')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(404)
    }

    expect(server.requests).to.have.length(1)
  })

  it('配列で渡したパラメータを同名キーで繰り返して送ること', async () => {
    server.respond('/api/v2/issues', {body: []})

    await client().getJson('/issues', {count: '100', 'id[]': ['10', '20', '30']})

    expect(server.requests[0].searchParams.getAll('id[]')).to.deep.equal(['10', '20', '30'])
    expect(server.requests[0].searchParams.get('count')).to.equal('100')
  })

  it('バイナリデータを取得できること', async () => {
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    server.respond('/api/v2/issues/TEST-1/attachments/1', {body: binary})

    const result = await client().getBinary('/issues/TEST-1/attachments/1')

    expect(new Uint8Array(result)).to.deep.equal(binary)
    expect(server.requests[0].searchParams.get('apiKey')).to.equal(API_KEY)
  })

  it('429はX-RateLimit-Resetまで待機してからリトライし、待機を通知すること', async () => {
    // リセット時刻が過去のため最小待機(1秒)でリトライされる
    server.respondOnce('/api/v2/projects/TEST', {
      headers: {'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 10)},
      status: 429,
    })
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})

    const notifiedWaits: number[] = []
    const notifyingClient = new BacklogHttpClient({
      apiKey: API_KEY,
      domain: server.domain,
      onRateLimitExceeded: (waitSeconds) => notifiedWaits.push(waitSeconds),
    })
    const result = await notifyingClient.getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
    expect(server.requests).to.have.length(2)
    expect(notifiedWaits).to.deep.equal([1])
  })

  it('429の待機は通常のリトライ上限を消費せず成功できること', async () => {
    // 通常のリトライ上限(2回)を超える3回の429を返しても、待機して成功する
    const headers = {'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 10)}
    server.respondOnce('/api/v2/projects/TEST', {headers, status: 429})
    server.respondOnce('/api/v2/projects/TEST', {headers, status: 429})
    server.respondOnce('/api/v2/projects/TEST', {headers, status: 429})
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})

    const result = await client().getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
    expect(server.requests).to.have.length(4)
  }, 10_000)

  it('429の待機回数が上限を超えた場合はHttpErrorをスローすること', async () => {
    const headers = {'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 10)}
    server.respond('/api/v2/projects/TEST', {headers, status: 429})

    try {
      await client().getJson('/projects/TEST')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(429)
    }

    // 初回 + 待機後リトライ5回
    expect(server.requests).to.have.length(6)
  }, 10_000)

  it('エラーメッセージのURL中のapiKeyがマスクされること', async () => {
    server.respond('/api/v2/projects/TEST', {status: 403})

    try {
      await client().getJson('/projects/TEST')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect((error as Error).message).to.include('apiKey=***')
      expect((error as Error).message).to.not.include(API_KEY)
    }
  })
})

// 401を受けたら新しいトークンに切り替える、OAuthと同じ振る舞いの認証
function rotatingAuth(): BacklogAuth & {recoveries: number} {
  let token = 'expired-token'
  const auth = {
    async credentials() {
      return {headers: {authorization: `Bearer ${token}`}, query: {}}
    },
    async recoverFromUnauthorized() {
      auth.recoveries++
      token = 'fresh-token'
    },
    recoveries: 0,
  }
  return auth
}

describe('BacklogHttpClient - OAuth', () => {
  const server = new BacklogMockServer()

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(() => server.reset())

  it('Authorizationヘッダーで送り、URLにapiKeyを付けないこと', async () => {
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})
    const auth = rotatingAuth()

    await new BacklogHttpClient({auth, domain: server.domain}).getJson('/projects/TEST')

    expect(server.received[0].headers.authorization).to.equal('Bearer expired-token')
    expect(server.requests[0].searchParams.has('apiKey')).to.be.false
  })

  it('401を受けたら認証情報を更新して1度だけ送り直すこと', async () => {
    server.respondOnce('/api/v2/projects/TEST', {status: 401})
    server.respond('/api/v2/projects/TEST', {body: {id: 1}})
    const auth = rotatingAuth()

    const result = await new BacklogHttpClient({auth, domain: server.domain}).getJson('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
    expect(auth.recoveries).to.equal(1)
    expect(server.received.map((request) => request.headers.authorization)).to.deep.equal([
      'Bearer expired-token',
      'Bearer fresh-token',
    ])
  })

  it('更新後も401ならHttpErrorをスローすること', async () => {
    server.respond('/api/v2/projects/TEST', {status: 401})
    const auth = rotatingAuth()

    await expect(new BacklogHttpClient({auth, domain: server.domain}).getJson('/projects/TEST')).rejects.toThrow(
      'HTTP 401',
    )
    expect(auth.recoveries).to.equal(1)
    expect(server.requests).to.have.length(2)
  })

  it('APIキーでは401を送り直さないこと', async () => {
    server.respond('/api/v2/projects/TEST', {status: 401})

    await expect(
      new BacklogHttpClient({apiKey: API_KEY, domain: server.domain}).getJson('/projects/TEST'),
    ).rejects.toThrow('HTTP 401')
    expect(server.requests).to.have.length(1)
  })
})
