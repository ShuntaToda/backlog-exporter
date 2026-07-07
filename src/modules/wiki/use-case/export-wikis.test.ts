import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {exportWikis} from './export-wikis.js'

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'

// 本文が `##` 見出しを含んでも、マーカー間として確実に切り出せることを確認するための本文
const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: DOMAIN})

describe('exportWikis', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-wikis-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Wikiの本文がマーカーで囲まれて保存されること', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query(true)
      .reply(200, [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}])
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis/111')
      .query(true)
      .reply(200, {content: BODY_WITH_HEADING, id: '111', name: 'WikiA'})

    await exportWikis(client(), stubLogger, {
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
    })

    expect(existsSync(join(outputDir, 'WikiA.md'))).to.be.true
    const content = await fs.readFile(join(outputDir, 'WikiA.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
  })

  it('本文が空の場合はプレースホルダがマーカーで囲まれること（課題・ドキュメントと同じ挙動）', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query(true)
      .reply(200, [{id: '222', name: '空Wiki', updated: '2026-01-02T00:00:00Z'}])
    nock(`https://${DOMAIN}`).get('/api/v2/wikis/222').query(true).reply(200, {content: '', id: '222', name: '空Wiki'})

    await exportWikis(client(), stubLogger, {
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
    })

    const content = await fs.readFile(join(outputDir, '空Wiki.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n（内容なし）\n${BODY_END_MARKER}`)
  })

  it('wikiIdsで指定したWikiのみ保存されること', async () => {
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

    await exportWikis(client(), stubLogger, {
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
})
