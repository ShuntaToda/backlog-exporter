import {expect} from 'chai'
import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {downloadDocuments} from '../../src/utils/backlog-api.js'

// downloadDocuments は oclif の Command に依存するが、log/warn しか使わないためスタブで十分
const stubCommand = {
  log() {},
  warn() {},
} as never

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345

/**
 * ドキュメント詳細レスポンスを組み立てる
 */
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

describe('downloadDocuments - 子を持つ親ドキュメントの本文', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-doc-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

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

    // 各ドキュメント詳細
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

    await downloadDocuments(stubCommand, {
      apiKey: API_KEY,
      domain: DOMAIN,
      outputDir,
      projectId: PROJECT_ID,
      projectIdOrKey: 'TEST',
    })

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
})
