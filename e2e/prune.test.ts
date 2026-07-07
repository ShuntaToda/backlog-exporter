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
  it('存在しないディレクトリを指定した場合は明確なエラーになること', async () => {
    const {error} = await runCli(['prune', join(rootDir, 'nope'), '--force', '--apiKey', API_KEY])

    expect(error?.message).to.include('指定されたディレクトリが存在しません')
  })


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

  it('課題フォルダもpruneの対象になり、削除済み課題のファイルのみ削除されること', async () => {
    const issueDir = join(rootDir, 'issues')
    await writeSettings(issueDir, {
      domain: server.domain,
      folderType: 'issue',
      issueKeyFileName: true,
      projectIdOrKey: PROJECT_KEY,
    })
    await fs.mkdir(join(issueDir, '2026'), {recursive: true})
    await fs.writeFile(join(issueDir, '2026', 'TEST-1.md'), '# 現存課題')
    await fs.writeFile(join(issueDir, '2026', 'TEST-9.md'), '# 削除済み課題')

    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: 1}})
    server.respond('/api/v2/issues', {
      body: [{created: '2026-01-02T00:00:00Z', issueKey: 'TEST-1', summary: '現存課題'}],
    })

    const {error, stdout} = await runCli(['prune', rootDir, '--force', '--apiKey', API_KEY])

    expect(error).to.be.undefined
    expect(stdout).to.include('1件の不要な課題ファイルを削除しました。')
    expect(existsSync(join(issueDir, '2026', 'TEST-1.md')), '現存課題は残ること').to.be.true
    expect(existsSync(join(issueDir, '2026', 'TEST-9.md')), '削除済み課題は削除されること').to.be.false
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
