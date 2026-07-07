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
  rootDir = await makeTempDir('backlog-e2e-prune-')
})

afterEach(async () => {
  await fs.rm(rootDir, {force: true, recursive: true})
})

describe('pruneコマンド', () => {
  it('--force指定でBacklog上に存在しない.mdファイルのみ削除すること', async () => {
    const wikiDir = join(rootDir, 'wiki')
    await writeSettings(wikiDir, {
      domain: server.domain,
      folderType: 'wiki',
      projectIdOrKey: PROJECT_KEY,
    })
    await fs.writeFile(join(wikiDir, 'Home.md'), '# Home')
    await fs.writeFile(join(wikiDir, '孤児.md'), '# 孤児')

    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'Home', updated: '2026-01-02T00:00:00Z'}]})

    const {error, stdout} = await runCli(['prune', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stdout).to.include('1件の不要なWikiファイルを削除しました。')
    expect(stdout).to.include(`${wikiDir} のpruneが完了しました！`)
    expect(existsSync(join(wikiDir, 'Home.md'))).to.be.true
    expect(existsSync(join(wikiDir, '孤児.md'))).to.be.false
  })

  it('課題フォルダはスキップし、何も削除しないこと', async () => {
    const issueDir = join(rootDir, 'issues')
    await writeSettings(issueDir, {
      domain: server.domain,
      folderType: 'issue',
      projectIdOrKey: PROJECT_KEY,
    })
    await fs.mkdir(join(issueDir, '2026'), {recursive: true})
    await fs.writeFile(join(issueDir, '2026', 'TEST-1.md'), '# 課題')

    const {error, stdout} = await runCli(['prune', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stdout).to.not.include('pruneが完了しました')
    expect(existsSync(join(issueDir, '2026', 'TEST-1.md'))).to.be.true
    expect(server.requests, 'APIを呼ばないこと').to.have.length(0)
  })

  it('非対話環境で--forceなしの場合はエラーで中止すること', async () => {
    const wikiDir = join(rootDir, 'wiki')
    await writeSettings(wikiDir, {
      domain: server.domain,
      folderType: 'wiki',
      projectIdOrKey: PROJECT_KEY,
    })
    await fs.writeFile(join(wikiDir, '孤児.md'), '# 孤児')

    const {error} = await runCli(['prune', rootDir, '--apiKey', API_KEY])

    expect(error?.message).to.include('対話的な確認ができない環境のため中止しました')
    expect(existsSync(join(wikiDir, '孤児.md')), '中止時は何も削除しないこと').to.be.true
  })
})
