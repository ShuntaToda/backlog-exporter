import {expect} from 'chai'
import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {pruneWikis} from '../../src/utils/backlog-api.js'

// pruneWikis は oclif の Command に依存するが、log/warn しか使わないためスタブで十分
const stubCommand = {
  log() {},
  warn() {},
} as never

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'

describe('pruneWikis（不要なローカルWikiの削除）', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-prune-wiki-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Backlog上に存在するWikiは残し、存在しない.mdファイルのみ削除すること', async () => {
    // Backlog上には WikiA のみ存在（WikiB は削除済み想定）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query({apiKey: API_KEY, projectIdOrKey: PROJECT_KEY})
      .reply(200, [{id: '1', name: 'WikiA', updated: '2026-01-01T00:00:00Z'}])

    await fs.writeFile(join(outputDir, 'WikiA.md'), '# WikiA')
    await fs.writeFile(join(outputDir, 'WikiB.md'), '# WikiB(削除済み)')

    const pruned = await pruneWikis(stubCommand, {
      apiKey: API_KEY,
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
    })

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'WikiA.md')), 'WikiA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'WikiB.md')), 'WikiB.md は削除されること').to.be.false
  })

  it('スラッシュを含むWiki名（階層）のファイルを正しく扱い、空ディレクトリを削除すること', async () => {
    // Backlog上には「親/子A」のみ存在。「親/子B」は削除済み想定。「旧親/旧子」フォルダごと削除済み想定。
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query({apiKey: API_KEY, projectIdOrKey: PROJECT_KEY})
      .reply(200, [{id: '1', name: '親/子A', updated: '2026-01-01T00:00:00Z'}])

    await fs.mkdir(join(outputDir, '親'), {recursive: true})
    await fs.writeFile(join(outputDir, '親', '子A.md'), '# 子A')
    await fs.writeFile(join(outputDir, '親', '子B.md'), '# 子B(削除済み)')
    await fs.mkdir(join(outputDir, '旧親'), {recursive: true})
    await fs.writeFile(join(outputDir, '旧親', '旧子.md'), '# 旧子(削除済み)')

    const pruned = await pruneWikis(stubCommand, {
      apiKey: API_KEY,
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
    })

    expect(pruned).to.equal(2)
    expect(existsSync(join(outputDir, '親', '子A.md')), '親/子A.md は残ること').to.be.true
    expect(existsSync(join(outputDir, '親', '子B.md')), '親/子B.md は削除されること').to.be.false
    expect(existsSync(join(outputDir, '親')), 'Backlog上に存在する親ディレクトリは残ること').to.be.true
    expect(existsSync(join(outputDir, '旧親', '旧子.md')), '旧親/旧子.md は削除されること').to.be.false
    expect(existsSync(join(outputDir, '旧親')), '空になった旧親ディレクトリは削除されること').to.be.false
  })

  it('設定ファイルや.md以外のユーザーファイルには触れないこと', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/wikis')
      .query({apiKey: API_KEY, projectIdOrKey: PROJECT_KEY})
      .reply(200, [])

    await fs.writeFile(join(outputDir, 'backlog-settings.json'), '{}')
    await fs.writeFile(join(outputDir, 'note.txt'), 'user file')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneWikis(stubCommand, {
      apiKey: API_KEY,
      domain: DOMAIN,
      outputDir,
      projectIdOrKey: PROJECT_KEY,
    })

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'backlog-settings.json')), '設定ファイルは保護').to.be.true
    expect(existsSync(join(outputDir, 'note.txt')), '.md以外は保護').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除').to.be.false
  })
})
