import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {downloadDocuments, downloadWikis} from '../../src/utils/backlog-api.js'
import {stubCommand} from '../helpers/stub-command.js'

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'
const PROJECT_ID = 12_345

describe('特定ID指定での再取得（Wiki / ドキュメント）', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-targeted-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('downloadWikis: wikiIdsで指定したWikiのみ保存されること', async () => {
    // Wiki一覧（3件）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query({apiKey: API_KEY, projectIdOrKey: PROJECT_KEY})
      .reply(200, [
        {id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'},
        {id: '222', name: 'WikiB', updated: '2026-01-02T00:00:00Z'},
        {id: '333', name: 'WikiC', updated: '2026-01-02T00:00:00Z'},
      ])

    // 指定したWiki（222）の詳細のみ取得されるはず
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis/222')
      .query({apiKey: API_KEY, projectIdOrKey: PROJECT_KEY})
      .reply(200, {content: 'WikiBの本文', id: '222', name: 'WikiB'})

    await downloadWikis(stubCommand, {
      apiKey: API_KEY,
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
      wikiIds: ['222'],
    })

    // 指定したWikiBのみ保存される
    expect(existsSync(join(outputDir, 'WikiB.md')), 'WikiB.md が保存されること').to.be.true
    expect(existsSync(join(outputDir, 'WikiA.md')), 'WikiA.md は保存されないこと').to.be.false
    expect(existsSync(join(outputDir, 'WikiC.md')), 'WikiC.md は保存されないこと').to.be.false

    const content = await fs.readFile(join(outputDir, 'WikiB.md'), 'utf8')
    expect(content).to.include('WikiBの本文')
  })

  it('downloadDocuments: documentIdsで指定したドキュメントのみ保存されること', async () => {
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
      .reply(200, {
        attachments: [],
        created: '2026-01-01T00:00:00Z',
        createdUser: {id: 1, name: '作成者'},
        id: 'da',
        json: '{}',
        plain: 'docAの本文',
        statusId: 1,
        tags: [],
        title: 'docA',
        updated: '2026-01-02T00:00:00Z',
        updatedUser: {id: 1, name: '更新者'},
      })

    await downloadDocuments(stubCommand, {
      apiKey: API_KEY,
      documentIds: ['da'],
      domain: DOMAIN,
      outputDir,
      projectId: PROJECT_ID,
      projectIdOrKey: PROJECT_KEY,
    })

    // 指定した docA のみフォルダ内に保存される
    expect(existsSync(join(outputDir, '設計', 'docA.md')), 'docA.md が保存されること').to.be.true
    expect(existsSync(join(outputDir, '設計', 'docB.md')), 'docB.md は保存されないこと').to.be.false

    const content = await fs.readFile(join(outputDir, '設計', 'docA.md'), 'utf8')
    expect(content).to.include('docAの本文')

    // docB の詳細APIが呼ばれていないこと（モック未登録なので呼ばれれば pendingMocks には残らない）
    expect(nock.pendingMocks()).to.deep.equal([])
  })
})
