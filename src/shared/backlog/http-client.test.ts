import nock from 'nock'
import {afterEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient, HttpError} from './http-client.js'

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'

describe('BacklogHttpClient', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  it('apiKeyを自動で付与してJSONを取得すること', async () => {
    nock(`https://${DOMAIN}`).get('/api/v2/projects/TEST').query({apiKey: API_KEY}).reply(200, {id: 1})

    const client = new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})
    const result = await client.getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
  })

  it('一時的な5xxエラーをリトライして成功すること', async () => {
    nock(`https://${DOMAIN}`).get('/api/v2/projects/TEST').query({apiKey: API_KEY}).reply(500)
    nock(`https://${DOMAIN}`).get('/api/v2/projects/TEST').query({apiKey: API_KEY}).reply(200, {id: 1})

    const client = new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})
    const result = await client.getJson<{id: number}>('/projects/TEST')

    expect(result).to.deep.equal({id: 1})
  })

  it('リトライ上限を超えた5xxエラーはHttpErrorとしてスローすること', async () => {
    nock(`https://${DOMAIN}`).persist().get('/api/v2/projects/TEST').query({apiKey: API_KEY}).reply(500)

    const client = new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

    try {
      await client.getJson('/projects/TEST')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(500)
    }
  })

  it('404はリトライせず即座にHttpErrorをスローすること', async () => {
    // 1回分だけモックする（リトライされるとnockが未定義エラーになる）
    nock(`https://${DOMAIN}`).get('/api/v2/projects/NONE').query({apiKey: API_KEY}).reply(404)

    const client = new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

    try {
      await client.getJson('/projects/NONE')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(HttpError)
      expect((error as HttpError).status).to.equal(404)
    }

    expect(nock.isDone()).to.be.true
  })

  it('エラーメッセージのURL中のapiKeyがマスクされること', async () => {
    nock(`https://${DOMAIN}`).get('/api/v2/projects/TEST').query({apiKey: API_KEY}).reply(403)

    const client = new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

    try {
      await client.getJson('/projects/TEST')
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect((error as Error).message).to.include('apiKey=***')
      expect((error as Error).message).to.not.include(API_KEY)
    }
  })
})
