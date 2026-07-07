import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {API_KEY, BacklogMockServer, makeTempDir, PROJECT_KEY, runCli, writeSettings} from './helpers.js'

const server = new BacklogMockServer()
let rootDir: string

beforeAll(() => server.start())
afterAll(() => server.stop())

beforeEach(async () => {
  server.reset()
  rootDir = await makeTempDir('backlog-e2e-update-')
})

afterEach(async () => {
  await fs.rm(rootDir, {force: true, recursive: true})
})

describe('updateコマンド', () => {
  it('存在しないディレクトリを指定した場合は明確なエラーになること', async () => {
    const {error} = await runCli(['update', join(rootDir, 'nope'), '--force', '--apiKey', API_KEY])

    expect(error?.message).to.include('指定されたディレクトリが存在しません')
  })

  it('設定ファイルが見つからない場合はその旨を表示すること', async () => {
    const {error, stderr} = await runCli(['update', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stderr).to.include('設定ファイル（backlog-settings.json）が見つかりませんでした')
  })


  it('設定ファイルを再帰的に探索し、差分がなければ何も書き換えないこと', async () => {
    const wikiDir = join(rootDir, 'wiki')
    await writeSettings(wikiDir, {
      domain: server.domain,
      folderType: 'wiki',
      lastUpdated: '2026-06-01T00:00:00Z',
      projectIdOrKey: PROJECT_KEY,
    })

    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: 1}})
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'Home', updated: '2026-01-02T00:00:00Z'}]})

    const {error, stdout} = await runCli(['update', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stdout).to.include('更新が必要なWikiはありません。')
    expect(stdout).to.include(`${wikiDir} の更新が完了しました！`)
    expect(existsSync(join(wikiDir, 'Home.md')), '未更新のWikiは書き出されないこと').to.be.false
  })

  it('--wikiId指定時は該当Wikiのみ再取得し、lastUpdatedを更新しないこと', async () => {
    const wikiDir = join(rootDir, 'wiki')
    const lastUpdated = '2026-06-01T00:00:00Z'
    await writeSettings(wikiDir, {
      domain: server.domain,
      folderType: 'wiki',
      lastUpdated,
      projectIdOrKey: PROJECT_KEY,
    })

    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: 1}})
    server.respond('/api/v2/wikis', {
      body: [
        {id: '111', name: 'Home', updated: '2026-01-02T00:00:00Z'},
        {id: '222', name: '対象Wiki', updated: '2026-01-02T00:00:00Z'},
      ],
    })
    server.respond('/api/v2/wikis/222', {body: {content: '再取得された本文', id: '222', name: '対象Wiki'}})

    const {error} = await runCli(['update', rootDir, '--force', '--apiKey', API_KEY, '--wikiId', '222'])

    expect(error).to.be.undefined
    expect(existsSync(join(wikiDir, '対象Wiki.md'))).to.be.true
    expect(existsSync(join(wikiDir, 'Home.md')), '指定外のWikiは取得しないこと').to.be.false

    const settings = JSON.parse(await fs.readFile(join(wikiDir, 'backlog-settings.json'), 'utf8'))
    expect(settings.lastUpdated, 'ID指定時はlastUpdatedを更新しないこと').to.equal(lastUpdated)
  })

  it('folderTypeのない設定ディレクトリでは全種別を更新対象にすること', async () => {
    const legacyDir = join(rootDir, 'legacy')
    await writeSettings(legacyDir, {
      domain: server.domain,
      projectIdOrKey: PROJECT_KEY,
    })

    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: 1}})
    server.respond('/api/v2/issues', {body: []})
    server.respond('/api/v2/wikis', {body: []})
    server.respond('/api/v2/documents/tree', {body: {activeTree: {children: [], id: 'root'}}})

    const {error, stdout} = await runCli(['update', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stdout).to.include('課題の更新が完了しました')
    expect(stdout).to.include('Wikiの更新が完了しました')
    expect(stdout).to.include('ドキュメントの更新が完了しました')
  })
})
