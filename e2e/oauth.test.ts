import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import process from 'node:process'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogMockServer, makeTempDir, PROJECT_ID, PROJECT_KEY, runCli} from './helpers.js'

const server = new BacklogMockServer()
const savedEnv = {...process.env}
let configDir: string
let outputDir: string

const TOKEN_BODY = JSON.parse(
  '{"access_token":"refreshed-access","expires_in":3600,"refresh_token":"refreshed-refresh","token_type":"Bearer"}',
)

// login で保存されるのと同じ形のログイン情報を、置き場に直接書く（ブラウザでの許可はE2Eで再現できないため）
async function writeSession(expiresAt: string): Promise<string> {
  const {host} = new URL(server.domain)
  const sessionPath = join(configDir, 'oauth', `${host.replaceAll(':', '_')}.json`)
  await fs.mkdir(join(configDir, 'oauth'), {recursive: true})
  await fs.writeFile(
    sessionPath,
    JSON.stringify({
      client: {clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'http://localhost:5033/callback'},
      domain: server.domain,
      token: {accessToken: 'saved-access', expiresAt, refreshToken: 'saved-refresh'},
    }),
  )
  return sessionPath
}

const exportWiki = () =>
  runCli(['wiki', '--domain', server.domain, '--projectIdOrKey', PROJECT_KEY, '--output', outputDir])

beforeAll(() => server.start())
afterAll(() => server.stop())

beforeEach(async () => {
  server.reset()
  server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: PROJECT_ID}})
  server.respond('/api/v2/wikis', {body: []})
  configDir = await makeTempDir('backlog-e2e-config-')
  outputDir = await makeTempDir('backlog-e2e-oauth-')
  delete process.env.BACKLOG_API_KEY
  process.env.BACKLOG_EXPORTER_CONFIG_DIR = configDir
})

afterEach(async () => {
  process.env = {...savedEnv}
  await fs.rm(configDir, {force: true, recursive: true})
  await fs.rm(outputDir, {force: true, recursive: true})
})

describe('OAuthのログイン情報でのエクスポート', () => {
  it('APIキーが無ければ保存済みのアクセストークンをBearerで送ること', async () => {
    await writeSession(new Date(Date.now() + 30 * 60_000).toISOString())

    const {error, stdout} = await exportWiki()

    expect(error).to.be.undefined
    expect(stdout).to.include('OAuthのログイン情報を使用します')
    const apiRequests = server.received.filter((request) => request.url.pathname !== '/api/v2/oauth2/token')
    expect(apiRequests.every((request) => request.headers.authorization === 'Bearer saved-access')).to.be.true
    expect(apiRequests.some((request) => request.url.searchParams.has('apiKey'))).to.be.false
  })

  it('期限切れのトークンは更新してから使い、新しいトークンを保存すること', async () => {
    const sessionPath = await writeSession(new Date(Date.now() - 1000).toISOString())
    server.respond('/api/v2/oauth2/token', {body: TOKEN_BODY})

    const {error} = await exportWiki()

    expect(error).to.be.undefined
    const tokenRequest = server.received.find((request) => request.url.pathname === '/api/v2/oauth2/token')
    expect(new URLSearchParams(tokenRequest!.body).get('refresh_token')).to.equal('saved-refresh')
    expect(server.received.at(-1)!.headers.authorization).to.equal('Bearer refreshed-access')
    const saved = JSON.parse(await fs.readFile(sessionPath, 'utf8'))
    expect(saved.token.refreshToken).to.equal('refreshed-refresh')
  })

  it('APIキーを指定すればログイン済みでもAPIキーを使うこと', async () => {
    await writeSession(new Date(Date.now() + 30 * 60_000).toISOString())

    const {error} = await runCli([
      'wiki',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      'explicit-key',
      '--output',
      outputDir,
    ])

    expect(error).to.be.undefined
    expect(server.received[0].headers.authorization).to.be.undefined
    expect(server.requests[0].searchParams.get('apiKey')).to.equal('explicit-key')
  })
})

describe('logoutコマンド', () => {
  it('保存したログイン情報を削除すること', async () => {
    const sessionPath = await writeSession(new Date(Date.now() + 30 * 60_000).toISOString())

    const {stdout} = await runCli(['logout', '--domain', server.domain])

    expect(stdout).to.include('ログイン情報を削除しました')
    expect(existsSync(sessionPath)).to.be.false
  })
})
