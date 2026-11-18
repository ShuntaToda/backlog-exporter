import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogMockServer} from '../testing/backlog-mock-server.js'
import {postTokenRequest} from './oauth-token-endpoint.js'

describe('postTokenRequest', () => {
  const server = new BacklogMockServer()

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(() => server.reset())

  it('パラメーターをフォーム形式でPOSTし、レスポンスの本文を返すこと', async () => {
    server.respond('/api/v2/oauth2/token', {body: {ok: true}})

    const body = await postTokenRequest(server.domain, new URLSearchParams([['grant_type', 'refresh_token']]))

    expect(body).to.deep.equal({ok: true})
    const [request] = server.received
    expect(request.method).to.equal('POST')
    expect(request.headers['content-type']).to.equal('application/x-www-form-urlencoded')
    expect(request.body).to.equal('grant_type=refresh_token')
  })

  it('失敗したらBacklogのエラーメッセージを含めて投げること', async () => {
    server.respond('/api/v2/oauth2/token', {body: {errors: [{message: 'invalid_grant'}]}, status: 400})

    await expect(postTokenRequest(server.domain, new URLSearchParams())).rejects.toThrow('HTTP 400 invalid_grant')
  })

  it('エラーの本文が読めなくてもステータスを伝えること', async () => {
    server.respond('/api/v2/oauth2/token', {body: new Uint8Array([0x7b]), status: 500})

    await expect(postTokenRequest(server.domain, new URLSearchParams())).rejects.toThrow('HTTP 500')
  })
})
