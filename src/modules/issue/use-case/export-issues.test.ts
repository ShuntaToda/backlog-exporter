import nock from 'nock'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {exportIssues} from './export-issues.js'

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345

// 本文が `##` 見出しを含んでも、マーカー間として確実に切り出せることを確認するための本文
const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

describe('exportIssues', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-issues-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('課題の詳細（本文）がマーカーで囲まれて保存されること', async () => {
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

    await exportIssues(client(), stubLogger, {
      domain: DOMAIN,
      outputDir,
      projectId: PROJECT_ID,
    })

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
    expect(content).to.include('# テスト課題')
    expect(content).to.include('- 課題キー: TEST-1')
  })

  it('コメントがコメントリンク付きで保存されること', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/issues')
      .query(true)
      .reply(200, [
        {
          assignee: null,
          created: '2026-01-02T00:00:00Z',
          customFields: [],
          description: '本文',
          dueDate: null,
          id: 1,
          issueKey: 'TEST-1',
          issueType: {id: 1, name: 'タスク'},
          priority: {id: 2, name: '中'},
          startDate: null,
          status: {id: 1, name: '未対応'},
          summary: 'コメント付き課題',
          updated: '2026-01-03T00:00:00Z',
        },
      ])
    nock(`https://${DOMAIN}`)
      .get('/api/v2/issues/TEST-1/comments')
      .query(true)
      .reply(200, [
        {
          content: 'コメント本文',
          created: '2026-01-02T10:00:00Z',
          createdUser: {id: 1, name: 'コメント投稿者'},
          id: 999,
        },
      ])

    await exportIssues(client(), stubLogger, {
      domain: DOMAIN,
      outputDir,
      projectId: PROJECT_ID,
    })

    const content = await fs.readFile(join(outputDir, '2026', 'コメント付き課題.md'), 'utf8')
    expect(content).to.include('## コメント')
    expect(content).to.include('コメント本文')
    expect(content).to.include(`[Backlog Comment Link](https://${DOMAIN}/view/TEST-1#comment-999)`)
  })

  it('issueIdOrKeys指定時は該当課題のみを取得すること', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/issues/TEST-2')
      .query(true)
      .reply(200, {
        assignee: null,
        created: '2026-01-02T00:00:00Z',
        customFields: [],
        description: '指定取得の本文',
        dueDate: null,
        id: 2,
        issueKey: 'TEST-2',
        issueType: {id: 1, name: 'タスク'},
        priority: {id: 2, name: '中'},
        startDate: null,
        status: {id: 1, name: '未対応'},
        summary: '指定課題',
        updated: '2026-01-03T00:00:00Z',
      })
    nock(`https://${DOMAIN}`).get('/api/v2/issues/TEST-2/comments').query(true).reply(200, [])

    await exportIssues(client(), stubLogger, {
      domain: DOMAIN,
      issueIdOrKeys: ['TEST-2'],
      outputDir,
      projectId: PROJECT_ID,
    })

    const content = await fs.readFile(join(outputDir, '2026', '指定課題.md'), 'utf8')
    expect(content).to.include('指定取得の本文')
    // 課題一覧APIは呼ばれない（モック未登録なのでnockがクリーンなまま）
    expect(nock.pendingMocks()).to.deep.equal([])
  })
})
