import {chmod, mkdtemp, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import process from 'node:process'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {OAuthSession} from '../domain/oauth-session.js'
import {configDirectory, deleteSession, loadSession, saveSession, sessionFilePath} from './oauth-session-store.js'

const SESSION: OAuthSession = {
  client: {clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'},
  domain: 'example.backlog.jp',
  token: {accessToken: 'access', expiresAt: '2026-01-01T01:00:00.000Z', refreshToken: 'refresh'},
}

describe('oauth-session-store', () => {
  let dir: string
  const savedEnv = {...process.env}

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'backlog-oauth-store-'))
    process.env.BACKLOG_EXPORTER_CONFIG_DIR = dir
  })

  afterEach(async () => {
    process.env = {...savedEnv}
    await rm(dir, {force: true, recursive: true})
  })

  it('保存したログイン情報をドメインで読み戻せること', async () => {
    await saveSession(SESSION)

    expect(await loadSession('example.backlog.jp')).to.deep.equal(SESSION)
    expect(await loadSession('other.backlog.jp')).to.be.undefined
  })

  it('プロトコル付きのドメインでも同じファイルを指すこと', () => {
    expect(sessionFilePath('https://example.backlog.jp')).to.equal(sessionFilePath('example.backlog.jp'))
  })

  it('ポート付きのドメインはファイル名に使える文字に置き換えること', () => {
    expect(sessionFilePath('http://127.0.0.1:8080')).to.equal(join(dir, 'oauth', '127.0.0.1_8080.json'))
  })

  it.skipIf(process.platform === 'win32')('本人だけが読める権限で保存すること', async () => {
    await saveSession(SESSION)

    expect((await stat(sessionFilePath('example.backlog.jp'))).mode.toString(8).slice(-3)).to.equal('600')
  })

  it.skipIf(process.platform === 'win32')('既にあるファイルも本人だけが読める権限に揃えること', async () => {
    await saveSession(SESSION)
    await chmod(sessionFilePath('example.backlog.jp'), 0o644)

    await saveSession(SESSION)

    expect((await stat(sessionFilePath('example.backlog.jp'))).mode.toString(8).slice(-3)).to.equal('600')
  })

  it('読めないファイルは再ログインを促すこと', async () => {
    await saveSession(SESSION)
    await writeFile(sessionFilePath('example.backlog.jp'), '{broken')

    await expect(loadSession('example.backlog.jp')).rejects.toThrow('backlog-exporter login')
  })

  it('削除したらtrue、無ければfalseを返すこと', async () => {
    await saveSession(SESSION)

    expect(await deleteSession('example.backlog.jp')).to.be.true
    expect(await loadSession('example.backlog.jp')).to.be.undefined
    expect(await deleteSession('example.backlog.jp')).to.be.false
  })

  it('置き場の指定が無ければXDG_CONFIG_HOMEの下を使うこと', () => {
    delete process.env.BACKLOG_EXPORTER_CONFIG_DIR
    process.env.XDG_CONFIG_HOME = join(dir, 'xdg')

    expect(configDirectory()).to.equal(join(dir, 'xdg', 'backlog-exporter'))
  })
})
