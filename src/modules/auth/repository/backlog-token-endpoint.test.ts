import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {requestToken} from './backlog-token-endpoint.js'

const NOW = Date.parse('2026-01-01T00:00:00Z')
const TOKEN_BODY = JSON.parse(
  '{"access_token":"access","expires_in":3600,"refresh_token":"refresh","token_type":"Bearer"}',
)

describe('requestToken', () => {
  const server = new BacklogMockServer()

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(() => server.reset())

  it('パラメーターをフォーム形式でPOSTし、トークンを返すこと', async () => {
    server.respond('/api/v2/oauth2/token', {body: TOKEN_BODY})

    const token = await requestToken(server.domain, new URLSearchParams([['grant_type', 'refresh_token']]), NOW)

    expect(token).to.deep.equal({accessToken: 'access', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'refresh'})
    const [request] = server.received
    expect(request.method).to.equal('POST')
    expect(request.headers['content-type']).to.equal('application/x-www-form-urlencoded')
    expect(request.body).to.equal('grant_type=refresh_token')
  })

  it('失敗したらBacklogのエラーメッセージを含めて投げること', async () => {
    server.respond('/api/v2/oauth2/token', {body: {errors: [{message: 'invalid_grant'}]}, status: 400})

    await expect(requestToken(server.domain, new URLSearchParams(), NOW)).rejects.toThrow('HTTP 400 invalid_grant')
  })

  it('エラーの本文が読めなくてもステータスを伝えること', async () => {
    server.respond('/api/v2/oauth2/token', {body: new Uint8Array([0x7b]), status: 500})

    await expect(requestToken(server.domain, new URLSearchParams(), NOW)).rejects.toThrow('HTTP 500')
  })
})
