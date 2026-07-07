import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {newBacklogDocumentRepository} from '../repository/backlog-document-repository.js'
import {exportDocuments} from './export-documents.js'

const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345
const PROJECT_KEY = 'TEST'

const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const documentDetail = (id: string, title: string, plain: string) => ({
  attachments: [],
  created: '2026-01-01T00:00:00Z',
  createdUser: {id: 1, name: '作成者'},
  id,
  json: '{}',
  plain,
  statusId: 1,
  tags: [],
  title,
  updated: '2026-01-02T00:00:00Z',
  updatedUser: {id: 1, name: '更新者'},
})

describe('exportDocuments', () => {
  const server = new BacklogMockServer()
  let outputDir: string

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-doc-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: server.domain})

  const exportOptions = (extra: Record<string, unknown> = {}) => ({
    domain: server.domain,
    outputDir,
    projectId: PROJECT_ID,
    projectIdOrKey: PROJECT_KEY,
    ...extra,
  })

  const respondTree = (children: unknown[]) => {
    server.respond('/api/v2/documents/tree', {
      body: {
        activeTree: {children, id: 'root'},
        projectId: PROJECT_ID,
        trashTree: {children: [], id: 'trash'},
      },
    })
  }

  it('ドキュメントの内容（本文）がマーカーで囲まれて保存されること', async () => {
    respondTree([{children: [], id: 'd1', name: 'ドキュメントA'}])
    server.respond('/api/v2/documents/d1', {body: documentDetail('d1', 'ドキュメントA', BODY_WITH_HEADING)})

    await exportDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      exportOptions(),
    )

    const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
  })

  it('documentIdsで指定したドキュメントのみ保存されること', async () => {
    respondTree([
      {
        children: [
          {children: [], id: 'da', name: 'docA'},
          {children: [], id: 'db', name: 'docB'},
        ],
        id: 'folder1',
        name: '設計',
      },
    ])
    server.respond('/api/v2/documents/da', {body: documentDetail('da', 'docA', 'docAの本文')})

    await exportDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      exportOptions({documentIds: ['da']}),
    )

    expect(existsSync(join(outputDir, '設計', 'docA.md')), 'docA.md が保存されること').to.be.true
    expect(existsSync(join(outputDir, '設計', 'docB.md')), 'docB.md は保存されないこと').to.be.false

    const content = await fs.readFile(join(outputDir, '設計', 'docA.md'), 'utf8')
    expect(content).to.include('docAの本文')

    // 指定外のドキュメントの詳細APIは呼ばれない
    expect(server.requestedPaths()).to.not.include('/api/v2/documents/db')
  })

  describe('子を持つ親ドキュメントの本文', () => {
    it('本文を持つ親はフォルダ内の 00_index.md に保存され、空の親は作成されないこと', async () => {
      respondTree([
        {
          children: [
            {children: [], id: 'childA', name: 'API仕様書A'},
            {children: [], id: 'childB', name: 'API仕様書B'},
          ],
          id: 'parent1',
          name: 'IF仕様書',
        },
        {
          children: [{children: [], id: 'childC', name: '子C'}],
          id: 'emptyParent',
          name: '空フォルダ',
        },
      ])

      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', 'API仕様書A', 'A本文')})
      server.respond('/api/v2/documents/childB', {body: documentDetail('childB', 'API仕様書B', 'B本文')})
      server.respond('/api/v2/documents/childC', {body: documentDetail('childC', '子C', 'C本文')})
      server.respond('/api/v2/documents/emptyParent', {body: documentDetail('emptyParent', '空フォルダ', '   ')})
      server.respond('/api/v2/documents/parent1', {
        body: documentDetail('parent1', 'IF仕様書', '親ドキュメントの本文です'),
      })

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      const indexPath = join(outputDir, 'IF仕様書', '00_index.md')
      expect(existsSync(indexPath), '親本文が IF仕様書/00_index.md に保存されること').to.be.true
      const indexContent = await fs.readFile(indexPath, 'utf8')
      expect(indexContent).to.include('# IF仕様書')
      expect(indexContent).to.include('親ドキュメントの本文です')

      expect(existsSync(join(outputDir, 'IF仕様書', 'API仕様書A.md'))).to.be.true
      expect(existsSync(join(outputDir, 'IF仕様書', 'API仕様書B.md'))).to.be.true

      expect(existsSync(join(outputDir, 'IF仕様書.md')), '同階層に親名のmdを作らないこと').to.be.false

      expect(existsSync(join(outputDir, '空フォルダ', '00_index.md')), '空の親はindexを作らないこと').to.be.false
      expect(existsSync(join(outputDir, '空フォルダ', '子C.md'))).to.be.true
    })

    it('親の本文が空に変更された場合、過去に作成した 00_index.md を削除すること', async () => {
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {body: documentDetail('parent1', '親フォルダ', '')})
      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', '子A', 'A本文')})

      await fs.mkdir(join(outputDir, '親フォルダ'), {recursive: true})
      await fs.writeFile(join(outputDir, '親フォルダ', '00_index.md'), '# 親フォルダ\n\n古い本文')

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '空になった親のindexは削除されること').to.be
        .false
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '子は保存されること').to.be.true
    })

    it('「00_index」というタイトルの子ドキュメントがある場合、親本文で上書きしないこと', async () => {
      respondTree([{children: [{children: [], id: 'child00', name: '00_index'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {body: documentDetail('parent1', '親フォルダ', '親の本文')})
      server.respond('/api/v2/documents/child00', {body: documentDetail('child00', '00_index', '子の本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      const content = await fs.readFile(join(outputDir, '親フォルダ', '00_index.md'), 'utf8')
      expect(content, '先に保存された子ドキュメントの内容が残ること').to.include('子の本文')
      expect(content, '親本文で上書きされないこと').to.not.include('親の本文')
    })

    it('増分更新でも、未作成の親indexはバックフィルとして作成すること（既存の子は再作成しない）', async () => {
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {body: documentDetail('parent1', '親フォルダ', '親の本文')})
      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', '子A', 'A本文')})

      // lastUpdated は全ドキュメントの updated(2026-01-02) より後 ＝ 通常は全てスキップされる
      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({lastUpdated: '2026-06-01T00:00:00Z'}),
      )

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '未作成の親indexはバックフィルされること').to.be
        .true
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '未更新の子はスキップされること').to.be.false
    })

    it('親の本文（plain）がnullでもクラッシュせず、空として扱うこと', async () => {
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {
        body: documentDetail('parent1', '親フォルダ', null as unknown as string),
      })
      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', '子A', 'A本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), 'nullの本文は空として扱いindexを作らないこと').to
        .be.false
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '子は保存されること').to.be.true
    })
  })
})
