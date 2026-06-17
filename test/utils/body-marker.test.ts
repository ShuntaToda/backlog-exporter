import {expect} from 'chai'
import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {
  BODY_END_MARKER,
  BODY_START_MARKER,
  downloadDocuments,
  downloadIssues,
  downloadWikis,
  wrapBody,
} from '../../src/utils/backlog-api.js'

// 各download関数は oclif の Command に依存するが、log/warn/error しか使わないためスタブで十分
const stubCommand = {
  error(message: string) {
    throw new Error(message)
  },
  log() {},
  warn() {},
} as never

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'
const PROJECT_ID = 12_345

// 本文が `##` 見出しを含んでも、マーカー間として確実に切り出せることを確認するための本文
const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

/** ディレクトリ配下の全 .md ファイルの内容を連結して返す */
const readAllMarkdown = async (dir: string): Promise<string> => {
  const entries = await fs.readdir(dir, {withFileTypes: true})
  let out = ''
  for (const entry of entries) {
    const full = join(dir, entry.name)
    // eslint-disable-next-line no-await-in-loop
    out += entry.isDirectory() ? await readAllMarkdown(full) : await fs.readFile(full, 'utf8')
  }

  return out
}

/** 本文がマーカーで囲まれていることを検証する */
const expectWrapped = (content: string, body: string): void => {
  const startIdx = content.indexOf(BODY_START_MARKER)
  const endIdx = content.indexOf(BODY_END_MARKER)
  expect(startIdx, '開始マーカーが存在すること').to.be.greaterThan(-1)
  expect(endIdx, '終了マーカーが存在すること').to.be.greaterThan(-1)
  expect(endIdx, '終了マーカーは開始マーカーより後ろにあること').to.be.greaterThan(startIdx)
  // マーカー間に本文がそのまま含まれること
  expect(content).to.include(`${BODY_START_MARKER}\n${body}\n${BODY_END_MARKER}`)
}

describe('本文マーカー（backlog-exporter:body）', () => {
  describe('wrapBody', () => {
    it('本文を開始・終了マーカーで囲むこと', () => {
      expect(wrapBody('あいうえお')).to.equal(`${BODY_START_MARKER}\nあいうえお\n${BODY_END_MARKER}`)
    })
  })

  describe('エクスポート出力での本文マーカー', () => {
    let outputDir: string

    beforeEach(async () => {
      outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-body-marker-'))
    })

    afterEach(async () => {
      nock.cleanAll()
      await fs.rm(outputDir, {force: true, recursive: true})
    })

    it('課題: 詳細（本文）がマーカーで囲まれること', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/issues')
        .query(true)
        .reply(200, [
          {
            assignee: null,
            created: '2026-01-02T00:00:00Z',
            customFields: [],
            description: BODY_WITH_HEADING,
            dueDate: null,
            id: 1,
            issueKey: 'TEST-1',
            issueType: {id: 1, name: 'タスク'},
            priority: {id: 2, name: '中'},
            startDate: null,
            status: {id: 1, name: '未対応'},
            summary: 'テスト課題',
            updated: '2026-01-03T00:00:00Z',
          },
        ])
      nock(`https://${DOMAIN}`).get('/api/v2/issues/TEST-1/comments').query(true).reply(200, [])

      await downloadIssues(stubCommand, {
        apiKey: API_KEY,
        domain: DOMAIN,
        outputDir,
        projectId: PROJECT_ID,
      })

      expectWrapped(await readAllMarkdown(outputDir), BODY_WITH_HEADING)
    })

    it('Wiki: 本文がマーカーで囲まれること', async () => {
      nock(`https://${DOMAIN}`)
        .get('/api/v2/wikis')
        .query(true)
        .reply(200, [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}])
      nock(`https://${DOMAIN}`)
        .get('/api/v2/wikis/111')
        .query(true)
        .reply(200, {content: BODY_WITH_HEADING, id: '111', name: 'WikiA'})

      await downloadWikis(stubCommand, {
        apiKey: API_KEY,
        domain: DOMAIN,
        outputDir,
        projectIdOrKey: PROJECT_KEY,
      })

      expect(existsSync(join(outputDir, 'WikiA.md'))).to.be.true
      expectWrapped(await readAllMarkdown(outputDir), BODY_WITH_HEADING)
    })

    it('ドキュメント: 内容（本文）がマーカーで囲まれること', async () => {
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
        .reply(200, {
          attachments: [],
          created: '2026-01-01T00:00:00Z',
          createdUser: {id: 1, name: '作成者'},
          id: 'd1',
          json: '{}',
          plain: BODY_WITH_HEADING,
          statusId: 1,
          tags: [],
          title: 'ドキュメントA',
          updated: '2026-01-02T00:00:00Z',
          updatedUser: {id: 1, name: '更新者'},
        })

      await downloadDocuments(stubCommand, {
        apiKey: API_KEY,
        domain: DOMAIN,
        outputDir,
        projectId: PROJECT_ID,
        projectIdOrKey: PROJECT_KEY,
      })

      expectWrapped(await readAllMarkdown(outputDir), BODY_WITH_HEADING)
    })
  })
})
