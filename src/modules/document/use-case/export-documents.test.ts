import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {exportDocuments} from './export-documents.js'

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345
const PROJECT_KEY = 'TEST'

// 本文が `##` 見出しを含んでも、マーカー間として確実に切り出せることを確認するための本文
const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

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

const exportOptions = (outputDir: string, extra: Record<string, unknown> = {}) => ({
  domain: DOMAIN,
  outputDir,
  projectId: PROJECT_ID,
  projectIdOrKey: PROJECT_KEY,
  ...extra,
})

describe('exportDocuments', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-doc-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('ドキュメントの内容（本文）がマーカーで囲まれて保存されること', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query(true)
      .reply(200, {
        activeTree: {children: [{children: [], id: 'd1', name: 'ドキュメントA'}], id: 'root'},
        projectId: PROJECT_ID,
        trashTree: {children: [], id: 'trash'},
      })
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/d1')
      .query(true)
      .reply(200, documentDetail('d1', 'ドキュメントA', BODY_WITH_HEADING))

    await exportDocuments(client(), stubLogger, exportOptions(outputDir))

    const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
  })

  it('documentIdsで指定したドキュメントのみ保存されること', async () => {
    // ドキュメントツリー（フォルダ「設計」配下に docA / docB）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {
          children: [
            {
              children: [
                {children: [], id: 'da', name: 'docA'},
                {children: [], id: 'db', name: 'docB'},
              ],
              id: 'folder1',
              name: '設計',
            },
          ],
          id: 'root',
        },
        projectId: PROJECT_ID,
        trashTree: {children: [], id: 'trash'},
      })

    // 指定した docA の詳細のみ取得されるはず（docB は API を叩く前にスキップされる）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/da')
      .query({apiKey: API_KEY})
      .reply(200, documentDetail('da', 'docA', 'docAの本文'))

    await exportDocuments(client(), stubLogger, exportOptions(outputDir, {documentIds: ['da']}))

    // 指定した docA のみフォルダ内に保存される
    expect(existsSync(join(outputDir, '設計', 'docA.md')), 'docA.md が保存されること').to.be.true
    expect(existsSync(join(outputDir, '設計', 'docB.md')), 'docB.md は保存されないこと').to.be.false

    const content = await fs.readFile(join(outputDir, '設計', 'docA.md'), 'utf8')
    expect(content).to.include('docAの本文')

    // docB の詳細APIが呼ばれていないこと
    expect(nock.pendingMocks()).to.deep.equal([])
  })

  describe('子を持つ親ドキュメントの本文', () => {
    it('本文を持つ親はフォルダ内の 00_index.md に保存され、空の親は作成されないこと', async () => {
      // ツリー: 本文ありの親(IF仕様書) と 本文なしの親(空フォルダ)
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/tree')
        .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
        .reply(200, {
          activeTree: {
            children: [
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
            ],
            id: 'root',
          },
          projectId: PROJECT_ID,
          trashTree: {children: [], id: 'trash'},
        })

      const details: Record<string, ReturnType<typeof documentDetail>> = {
        childA: documentDetail('childA', 'API仕様書A', 'A本文'),
        childB: documentDetail('childB', 'API仕様書B', 'B本文'),
        childC: documentDetail('childC', '子C', 'C本文'),
        emptyParent: documentDetail('emptyParent', '空フォルダ', '   '), // 空白のみ＝実質空
        parent1: documentDetail('parent1', 'IF仕様書', '親ドキュメントの本文です'),
      }

      for (const id of Object.keys(details)) {
        nock(`https://${DOMAIN}`).get(`/api/v2/documents/${id}`).query({apiKey: API_KEY}).reply(200, details[id])
      }

      await exportDocuments(client(), stubLogger, exportOptions(outputDir))

      // 本文を持つ親はフォルダ内の 00_index.md に保存される
      const indexPath = join(outputDir, 'IF仕様書', '00_index.md')
      expect(existsSync(indexPath), '親本文が IF仕様書/00_index.md に保存されること').to.be.true
      const indexContent = await fs.readFile(indexPath, 'utf8')
      expect(indexContent).to.include('# IF仕様書')
      expect(indexContent).to.include('親ドキュメントの本文です')

      // 子はフォルダ内にそのまま保存される
      expect(existsSync(join(outputDir, 'IF仕様書', 'API仕様書A.md'))).to.be.true
      expect(existsSync(join(outputDir, 'IF仕様書', 'API仕様書B.md'))).to.be.true

      // 旧挙動（フォルダと同階層に親名のmd）は作られない
      expect(existsSync(join(outputDir, 'IF仕様書.md')), '同階層に親名のmdを作らないこと').to.be.false

      // 本文が空の親は 00_index.md を作らない（フォルダと子のみ）
      expect(existsSync(join(outputDir, '空フォルダ', '00_index.md')), '空の親はindexを作らないこと').to.be.false
      expect(existsSync(join(outputDir, '空フォルダ', '子C.md'))).to.be.true
    })

    it('親の本文が空に変更された場合、過去に作成した 00_index.md を削除すること', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/tree')
        .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
        .reply(200, {
          activeTree: {
            children: [{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}],
            id: 'root',
          },
          projectId: PROJECT_ID,
          trashTree: {children: [], id: 'trash'},
        })

      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/parent1')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('parent1', '親フォルダ', '')) // 本文が空に変更された
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/childA')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('childA', '子A', 'A本文'))

      // 過去の実行で作成された親index
      await fs.mkdir(join(outputDir, '親フォルダ'), {recursive: true})
      await fs.writeFile(join(outputDir, '親フォルダ', '00_index.md'), '# 親フォルダ\n\n古い本文')

      await exportDocuments(client(), stubLogger, exportOptions(outputDir))

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '空になった親のindexは削除されること').to.be
        .false
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '子は保存されること').to.be.true
    })

    it('「00_index」というタイトルの子ドキュメントがある場合、親本文で上書きしないこと', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/tree')
        .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
        .reply(200, {
          activeTree: {
            children: [
              {children: [{children: [], id: 'child00', name: '00_index'}], id: 'parent1', name: '親フォルダ'},
            ],
            id: 'root',
          },
          projectId: PROJECT_ID,
          trashTree: {children: [], id: 'trash'},
        })

      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/parent1')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('parent1', '親フォルダ', '親の本文'))
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/child00')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('child00', '00_index', '子の本文'))

      await exportDocuments(client(), stubLogger, exportOptions(outputDir))

      const content = await fs.readFile(join(outputDir, '親フォルダ', '00_index.md'), 'utf8')
      expect(content, '先に保存された子ドキュメントの内容が残ること').to.include('子の本文')
      expect(content, '親本文で上書きされないこと').to.not.include('親の本文')
    })

    it('増分更新でも、未作成の親indexはバックフィルとして作成すること（既存の子は再作成しない）', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/tree')
        .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
        .reply(200, {
          activeTree: {
            children: [{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}],
            id: 'root',
          },
          projectId: PROJECT_ID,
          trashTree: {children: [], id: 'trash'},
        })

      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/parent1')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('parent1', '親フォルダ', '親の本文'))
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/childA')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('childA', '子A', 'A本文'))

      // lastUpdated は全ドキュメントの updated(2026-01-02) より後 ＝ 通常は全てスキップされる
      await exportDocuments(client(), stubLogger, exportOptions(outputDir, {lastUpdated: '2026-06-01T00:00:00Z'}))

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '未作成の親indexはバックフィルされること').to.be
        .true
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '未更新の子はスキップされること').to.be.false
    })

    it('親の本文（plain）がnullでもクラッシュせず、空として扱うこと', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/tree')
        .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
        .reply(200, {
          activeTree: {
            children: [{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}],
            id: 'root',
          },
          projectId: PROJECT_ID,
          trashTree: {children: [], id: 'trash'},
        })

      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/parent1')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('parent1', '親フォルダ', null as unknown as string))
      nock(`https://${DOMAIN}`)
        .get('/api/v2/documents/childA')
        .query({apiKey: API_KEY})
        .reply(200, documentDetail('childA', '子A', 'A本文'))

      await exportDocuments(client(), stubLogger, exportOptions(outputDir))

      expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), 'nullの本文は空として扱いindexを作らないこと').to
        .be.false
      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '子は保存されること').to.be.true
    })
  })
})
