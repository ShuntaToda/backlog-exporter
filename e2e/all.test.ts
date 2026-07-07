import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {API_KEY, BacklogMockServer, issuePayload, makeTempDir, PROJECT_ID, PROJECT_KEY, runCli} from './helpers.js'

const server = new BacklogMockServer()
let outputDir: string

beforeAll(() => server.start())
afterAll(() => server.stop())

beforeEach(async () => {
  server.reset()
  server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: PROJECT_ID}})
  outputDir = await makeTempDir('backlog-e2e-all-')
})

afterEach(async () => {
  await fs.rm(outputDir, {force: true, recursive: true})
})

describe('allコマンド', () => {
  it('--only issues,wiki 指定時はドキュメントを取得しないこと', async () => {
    server.respond('/api/v2/issues', {body: [issuePayload()]})
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'Home', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {body: {content: 'Homeの本文', id: '111', name: 'Home'}})

    const {error, stdout} = await runCli([
      'all',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--output',
      outputDir,
      '--only',
      'issues,wiki',
    ])

    expect(error).to.be.undefined
    expect(stdout).to.include('すべてのデータの取得が完了しました！')
    expect(existsSync(join(outputDir, 'issues', '2026', 'テスト課題.md'))).to.be.true
    expect(existsSync(join(outputDir, 'wiki', 'Home.md'))).to.be.true
    expect(existsSync(join(outputDir, 'documents')), 'documentsフォルダは作られないこと').to.be.false
    expect(server.requestedPaths()).to.not.include('/api/v2/documents/tree')
  })

  it('--onlyと--excludeの併用はエラーになること', async () => {
    const {error} = await runCli([
      'all',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--only',
      'issues',
      '--exclude',
      'wiki',
    ])

    expect(error?.message).to.include('Cannot use both --only and --exclude flags together')
  })
})
