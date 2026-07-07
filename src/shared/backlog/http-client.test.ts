import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogMockServer} from '../testing/backlog-mock-server.js'
import {BacklogHttpClient, HttpError} from './http-client.js'

const API_KEY = 'test-api-key'

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
