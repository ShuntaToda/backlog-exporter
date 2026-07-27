import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {newBacklogWikiRepository} from '../repository/backlog-wiki-repository.js'
import {exportWikis} from './export-wikis.js'

const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'

const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

describe('exportWikis', () => {
  const server = new BacklogMockServer()
  let outputDir: string

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-wikis-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: server.domain})

  it('Wikiの本文がマーカーで囲まれて保存されること', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {body: {content: BODY_WITH_HEADING, id: '111', name: 'WikiA'}})

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      },
    )

    expect(existsSync(join(outputDir, 'WikiA.md'))).to.be.true
    const content = await fs.readFile(join(outputDir, 'WikiA.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
  })

  it('本文が空の場合はプレースホルダがマーカーで囲まれること（課題・ドキュメントと同じ挙動）', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '222', name: '空Wiki', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/222', {body: {content: '', id: '222', name: '空Wiki'}})

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      },
    )

    const content = await fs.readFile(join(outputDir, '空Wiki.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n（内容なし）\n${BODY_END_MARKER}`)
  })

  it('wikiIdsで指定したWikiのみ保存されること', async () => {
    server.respond('/api/v2/wikis', {
      body: [
        {id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'},
        {id: '222', name: 'WikiB', updated: '2026-01-02T00:00:00Z'},
        {id: '333', name: 'WikiC', updated: '2026-01-02T00:00:00Z'},
      ],
    })
    server.respond('/api/v2/wikis/222', {body: {content: 'WikiBの本文', id: '222', name: 'WikiB'}})

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
        wikiIds: ['222'],
      },
    )

    expect(existsSync(join(outputDir, 'WikiB.md')), 'WikiB.md が保存されること').to.be.true
    expect(existsSync(join(outputDir, 'WikiA.md')), 'WikiA.md は保存されないこと').to.be.false
    expect(existsSync(join(outputDir, 'WikiC.md')), 'WikiC.md は保存されないこと').to.be.false

    // 指定外のWikiの詳細APIは呼ばれない
    expect(server.requestedPaths()).to.not.include('/api/v2/wikis/111')
    expect(server.requestedPaths()).to.not.include('/api/v2/wikis/333')
  })

  it('downloadAttachments指定時に添付を保存し、本文は原文のまま維持すること', async () => {
    const binary = new Uint8Array([1, 2, 3, 4])
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {
      body: {
        attachments: [{id: 9, name: 'design.png', size: 4}],
        content: '説明\n![image][design.png]',
        id: '111',
        name: 'WikiA',
      },
    })
    server.respond('/api/v2/wikis/111/attachments/9', {body: binary})

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      },
    )

    const saved = await fs.readFile(join(outputDir, 'attachments', 'WikiA', '9_design.png'))
    expect(new Uint8Array(saved)).to.deep.equal(binary)

    const content = await fs.readFile(join(outputDir, 'WikiA.md'), 'utf8')
    expect(content).to.include('## 添付ファイル')
    expect(content).to.include('- [design.png](./attachments/WikiA/9_design.png) (0.0 KB)')
    expect(content, '本文はBacklogの原文のまま維持されること').to.include('説明\n![image][design.png]')
  })

  it('階層Wikiの添付はMarkdownと同じディレクトリのattachmentsに保存されること', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '222', name: '運用/手順書', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/222', {
      body: {
        attachments: [{id: 10, name: 'manual.pdf', size: 2}],
        content: '手順',
        id: '222',
        name: '運用/手順書',
      },
    })
    server.respond('/api/v2/wikis/222/attachments/10', {body: new Uint8Array([5, 6])})

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      },
    )

    expect(existsSync(join(outputDir, '運用', 'attachments', '手順書', '10_manual.pdf'))).to.be.true
    const content = await fs.readFile(join(outputDir, '運用', '手順書.md'), 'utf8')
    expect(content).to.include('- [manual.pdf](./attachments/手順書/10_manual.pdf)')
  })

  it('downloadAttachments未指定時はダウンロードせず、メタデータのみ記載すること', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {
      body: {
        attachments: [{id: 9, name: 'design.png', size: 2048}],
        content: '本文',
        id: '111',
        name: 'WikiA',
      },
    })

    await exportWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {
        domain: server.domain,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      },
    )

    expect(server.requestedPaths()).to.not.include('/api/v2/wikis/111/attachments/9')
    const content = await fs.readFile(join(outputDir, 'WikiA.md'), 'utf8')
    expect(content).to.include('- design.png (2.0 KB)')
    expect(content).to.not.include('](./attachments')
  })
})
