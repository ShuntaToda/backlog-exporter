import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {API_KEY, BacklogMockServer, documentPayload, issuePayload, makeTempDir, PROJECT_ID, PROJECT_KEY, runCli} from './helpers.js'

const server = new BacklogMockServer()
let outputDir: string

beforeAll(() => server.start())
afterAll(() => server.stop())

beforeEach(async () => {
  server.reset()
  server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: PROJECT_ID}})
  outputDir = await makeTempDir('backlog-e2e-export-')
})

afterEach(async () => {
  await fs.rm(outputDir, {force: true, recursive: true})
})

describe('issueコマンド', () => {
  it('課題をエクスポートし、設定ファイルとログを保存すること', async () => {
    server.respond('/api/v2/issues', {body: [issuePayload()]})
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    const {error, stdout} = await runCli([
      'issue',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--output',
      outputDir,
    ])

    expect(error).to.be.undefined
    expect(stdout).to.include('課題の取得が完了しました！')

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('# テスト課題')

    const settings = JSON.parse(await fs.readFile(join(outputDir, 'backlog-settings.json'), 'utf8'))
    expect(settings.folderType).to.equal('issue')
    expect(settings.projectIdOrKey).to.equal(PROJECT_KEY)
    expect(settings.apiKey, 'apiKeyは設定ファイルに保存しないこと').to.be.undefined
    expect(settings.lastUpdated).to.be.a('string')

    expect(existsSync(join(outputDir, 'backlog-update.log'))).to.be.true
  })
})

describe('wikiコマンド', () => {
  it('Wikiを階層構造つきでエクスポートすること', async () => {
    server.respond('/api/v2/wikis', {
      body: [
        {id: '111', name: 'Home', updated: '2026-01-02T00:00:00Z'},
        {id: '222', name: '親/子', updated: '2026-01-02T00:00:00Z'},
      ],
    })
    server.respond('/api/v2/wikis/111', {body: {content: 'Homeの本文', id: '111', name: 'Home'}})
    server.respond('/api/v2/wikis/222', {body: {content: '子の本文', id: '222', name: '親/子'}})

    const {error, stdout} = await runCli([
      'wiki',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--output',
      outputDir,
    ])

    expect(error).to.be.undefined
    expect(stdout).to.include('Wikiの取得が完了しました！')
    expect(existsSync(join(outputDir, 'Home.md'))).to.be.true
    expect(existsSync(join(outputDir, '親', '子.md')), '階層Wikiはディレクトリとして保存されること').to.be.true
  })
})

describe('documentコマンド', () => {
  it('ツリー構造と親ドキュメント本文（00_index.md）をエクスポートすること', async () => {
    server.respond('/api/v2/documents/tree', {
      body: {
        activeTree: {
          children: [{children: [{children: [], id: 'child1', name: '子ドキュメント'}], id: 'parent1', name: '親フォルダ'}],
          id: 'root',
        },
        projectId: PROJECT_ID,
        trashTree: {children: [], id: 'trash'},
      },
    })
    server.respond('/api/v2/documents', {body: []})
    server.respond('/api/v2/documents/parent1', {body: documentPayload('parent1', '親フォルダ', '親の本文')})
    server.respond('/api/v2/documents/child1', {body: documentPayload('child1', '子ドキュメント', '子の本文')})

    const {error, stdout} = await runCli([
      'document',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--output',
      outputDir,
    ])

    expect(error).to.be.undefined
    expect(stdout).to.include('ドキュメントの取得が完了しました！')
    expect(existsSync(join(outputDir, '親フォルダ', '子ドキュメント.md'))).to.be.true
    expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '親本文が00_index.mdに保存されること').to.be.true
  })

  it('ツリーに現れないドキュメントを一覧APIから補完してエクスポートすること', async () => {
    server.respond('/api/v2/documents/tree', {
      body: {
        activeTree: {children: [{children: [], id: 'doc1', name: 'ツリー内'}], id: 'root'},
        projectId: PROJECT_ID,
        trashTree: {children: [], id: 'trash'},
      },
    })
    server.respond('/api/v2/documents', {
      body: [
        {id: 'doc1', title: 'ツリー内'},
        {id: 'doc2', title: 'ツリー外'},
      ],
    })
    server.respond('/api/v2/documents/doc1', {body: documentPayload('doc1', 'ツリー内', 'ツリー内の本文')})
    server.respond('/api/v2/documents/doc2', {body: documentPayload('doc2', 'ツリー外', 'ツリー外の本文')})

    const {error} = await runCli([
      'document',
      '--domain',
      server.domain,
      '--projectIdOrKey',
      PROJECT_KEY,
      '--apiKey',
      API_KEY,
      '--output',
      outputDir,
    ])

    expect(error).to.be.undefined
    expect(existsSync(join(outputDir, 'ツリー内.md'))).to.be.true
    expect(existsSync(join(outputDir, 'ツリー外.md')), 'ツリーに無いドキュメントも保存されること').to.be.true
  })
})

describe('APIキー未指定', () => {
  it('BACKLOG_API_KEYも未設定の場合はエラーになること', async () => {
    const saved = process.env.BACKLOG_API_KEY
    delete process.env.BACKLOG_API_KEY

    try {
      const {error} = await runCli([
        'wiki',
        '--domain',
        server.domain,
        '--projectIdOrKey',
        PROJECT_KEY,
        '--output',
        outputDir,
      ])

      expect(error?.message).to.include('APIキーが見つかりません')
    } finally {
      process.env.BACKLOG_API_KEY = saved
    }
  })
})
