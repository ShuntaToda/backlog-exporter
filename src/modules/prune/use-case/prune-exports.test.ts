import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {newBacklogDocumentRepository} from '../../document/repository/backlog-document-repository.js'
import {newBacklogIssueRepository} from '../../issue/repository/backlog-issue-repository.js'
import {newBacklogWikiRepository} from '../../wiki/repository/backlog-wiki-repository.js'
import {pruneDocuments, pruneIssues, pruneWikis} from './prune-exports.js'

const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345
const PROJECT_KEY = 'TEST'

const server = new BacklogMockServer()
const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: server.domain})

beforeAll(() => server.start())
afterAll(() => server.stop())

const respondTree = (children: unknown[]) => {
  server.respond('/api/v2/documents/tree', {body: {activeTree: {children, id: 'root'}}})
}

const respondDocumentList = (documents: Array<{id: string; title: string}>) => {
  server.respond('/api/v2/documents', {body: documents})
}

describe('pruneDocuments（不要なローカルドキュメントの削除）', () => {
  let outputDir: string

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-prune-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Backlog上に存在するファイルは残し、存在しない.mdファイルのみ削除すること', async () => {
    respondTree([{children: [], id: 'da', name: 'docA'}])
    respondDocumentList([{id: 'da', title: 'docA'}])

    await fs.writeFile(join(outputDir, 'docA.md'), '# docA')
    await fs.writeFile(join(outputDir, 'docB.md'), '# docB(削除済み)')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'docA.md')), 'docA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'docB.md')), 'docB.md は削除されること').to.be.false
  })

  it('ツリーのnameと一覧のtitleが異なる場合でも、title基準で保存されたファイルを誤削除しないこと', async () => {
    respondTree([{children: [], id: 'dx', name: '旧タイトル'}])
    respondDocumentList([{id: 'dx', title: '新タイトル'}])

    await fs.writeFile(join(outputDir, '新タイトル.md'), '# 新タイトル')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, '新タイトル.md')), '新タイトル.md は残ること').to.be.true
  })

  it('設定ファイルや.md以外のユーザーファイルには触れないこと', async () => {
    respondTree([])

    await fs.writeFile(join(outputDir, 'backlog-settings.json'), '{}')
    await fs.writeFile(join(outputDir, 'backlog-update.log'), 'log')
    await fs.writeFile(join(outputDir, 'note.txt'), 'user file')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'backlog-settings.json')), '設定ファイルは保護').to.be.true
    expect(existsSync(join(outputDir, 'backlog-update.log')), 'ログは保護').to.be.true
    expect(existsSync(join(outputDir, 'note.txt')), '.md以外は保護').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除').to.be.false
  })

  it('移動されたドキュメントの旧パスを削除し、空になったディレクトリも削除すること', async () => {
    respondTree([{children: [{children: [], id: 'dm', name: 'docM'}], id: 'f-new', name: '新フォルダ'}])
    respondDocumentList([{id: 'dm', title: 'docM'}])

    await fs.mkdir(join(outputDir, '旧フォルダ'), {recursive: true})
    await fs.writeFile(join(outputDir, '旧フォルダ', 'docM.md'), '# docM(旧パス)')
    await fs.mkdir(join(outputDir, '新フォルダ'), {recursive: true})
    await fs.writeFile(join(outputDir, '新フォルダ', 'docM.md'), '# docM(新パス)')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '旧フォルダ', 'docM.md')), '旧パスのファイルは削除').to.be.false
    expect(existsSync(join(outputDir, '旧フォルダ')), '空になった旧フォルダは削除').to.be.false
    expect(existsSync(join(outputDir, '新フォルダ', 'docM.md')), '新パスのファイルは残る').to.be.true
  })

  it('ドキュメント一覧の取得に失敗した場合は、誤削除防止のため何も削除せずにエラーで中断すること', async () => {
    respondTree([{children: [], id: 'da', name: 'docA'}])
    server.respond('/api/v2/documents', {status: 500})

    await fs.writeFile(join(outputDir, 'docA.md'), '# docA')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 本来は削除対象')

    let thrown: unknown
    try {
      await pruneDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        {outputDir, projectId: PROJECT_ID},
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown, '一覧取得の失敗でエラーになること').to.be.instanceOf(Error)
    expect(existsSync(join(outputDir, 'docA.md')), 'docA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), '中断時は削除対象のファイルにも触れないこと').to.be.true
  })

  it('子を持たない空フォルダ（ドキュメント一覧に現れない）はフォルダとして扱い、対応する空ディレクトリを残すこと', async () => {
    respondTree([{children: [], id: 'f-empty', name: '空フォルダ'}])
    respondDocumentList([])

    await fs.mkdir(join(outputDir, '空フォルダ'), {recursive: true})

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, '空フォルダ')), 'Backlog上に存在する空フォルダは残ること').to.be.true
  })

  it('タイトルの大文字小文字のみが変わった場合に、旧表記のままのローカルファイルを誤削除しないこと', async () => {
    respondTree([{children: [], id: 'dr', name: 'README'}])
    respondDocumentList([{id: 'dr', title: 'README'}])

    await fs.writeFile(join(outputDir, 'Readme.md'), '# Readme')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, 'Readme.md')), '大文字小文字違いのファイルは残ること').to.be.true
  })

  it('ドキュメントが100件を超える場合はページングで全件のタイトルを取得すること', async () => {
    const treeChildren = Array.from({length: 101}, (_, i) => ({children: [], id: `d${i}`, name: `doc${i}`}))
    respondTree(treeChildren)

    server.respond('/api/v2/documents', (url) => {
      const offset = Number(url.searchParams.get('offset'))
      expect(url.searchParams.get('projectId[]')).to.equal(String(PROJECT_ID))
      return offset === 0
        ? {body: Array.from({length: 100}, (_, i) => ({id: `d${i}`, title: `doc${i}`}))}
        : {body: [{id: 'd100', title: 'doc100'}]}
    })

    await fs.writeFile(join(outputDir, 'doc100.md'), '# doc100')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'doc100.md')), '2ページ目のドキュメントも保護されること').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除されること').to.be.false
  })

  it('親ドキュメント本文（00_index.md）は削除対象から保護されること', async () => {
    respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
    respondDocumentList([{id: 'childA', title: '子A'}])

    await fs.mkdir(join(outputDir, '親フォルダ'), {recursive: true})
    await fs.writeFile(join(outputDir, '親フォルダ', '00_index.md'), '# 親フォルダ\n\n親の本文')
    await fs.writeFile(join(outputDir, '親フォルダ', '子A.md'), '# 子A')
    await fs.writeFile(join(outputDir, '親フォルダ', 'orphan.md'), '# 削除対象')

    const pruned = await pruneDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      {outputDir, projectId: PROJECT_ID},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '親フォルダ', '00_index.md')), '親indexは保護されること').to.be.true
    expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), '子は保護されること').to.be.true
    expect(existsSync(join(outputDir, '親フォルダ', 'orphan.md')), '孤児は削除されること').to.be.false
  })
})

describe('pruneWikis（不要なローカルWikiの削除）', () => {
  let outputDir: string

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-prune-wiki-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Backlog上に存在するWikiは残し、存在しない.mdファイルのみ削除すること', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '1', name: 'WikiA', updated: '2026-01-01T00:00:00Z'}]})

    await fs.writeFile(join(outputDir, 'WikiA.md'), '# WikiA')
    await fs.writeFile(join(outputDir, 'WikiB.md'), '# WikiB(削除済み)')

    const pruned = await pruneWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {outputDir, projectIdOrKey: PROJECT_KEY},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'WikiA.md')), 'WikiA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'WikiB.md')), 'WikiB.md は削除されること').to.be.false
  })

  it('スラッシュを含むWiki名（階層）のファイルを正しく扱い、空ディレクトリを削除すること', async () => {
    server.respond('/api/v2/wikis', {body: [{id: '1', name: '親/子A', updated: '2026-01-01T00:00:00Z'}]})

    await fs.mkdir(join(outputDir, '親'), {recursive: true})
    await fs.writeFile(join(outputDir, '親', '子A.md'), '# 子A')
    await fs.writeFile(join(outputDir, '親', '子B.md'), '# 子B(削除済み)')
    await fs.mkdir(join(outputDir, '旧親'), {recursive: true})
    await fs.writeFile(join(outputDir, '旧親', '旧子.md'), '# 旧子(削除済み)')

    const pruned = await pruneWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {outputDir, projectIdOrKey: PROJECT_KEY},
    )

    expect(pruned).to.equal(2)
    expect(existsSync(join(outputDir, '親', '子A.md')), '親/子A.md は残ること').to.be.true
    expect(existsSync(join(outputDir, '親', '子B.md')), '親/子B.md は削除されること').to.be.false
    expect(existsSync(join(outputDir, '親')), 'Backlog上に存在する親ディレクトリは残ること').to.be.true
    expect(existsSync(join(outputDir, '旧親', '旧子.md')), '旧親/旧子.md は削除されること').to.be.false
    expect(existsSync(join(outputDir, '旧親')), '空になった旧親ディレクトリは削除されること').to.be.false
  })

  it('設定ファイルや.md以外のユーザーファイルには触れないこと', async () => {
    server.respond('/api/v2/wikis', {body: []})

    await fs.writeFile(join(outputDir, 'backlog-settings.json'), '{}')
    await fs.writeFile(join(outputDir, 'note.txt'), 'user file')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneWikis(
      {logger: stubLogger, wikiRepository: newBacklogWikiRepository(client())},
      {outputDir, projectIdOrKey: PROJECT_KEY},
    )

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'backlog-settings.json')), '設定ファイルは保護').to.be.true
    expect(existsSync(join(outputDir, 'note.txt')), '.md以外は保護').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除').to.be.false
  })
})

const issue = (issueKey: string, summary: string, created = '2026-01-02T00:00:00Z') => ({
  created,
  issueKey,
  summary,
})

const issuePruneDeps = () => ({issueRepository: newBacklogIssueRepository(client()), logger: stubLogger})

describe('pruneIssues（不要なローカル課題ファイルの削除）', () => {
  let outputDir: string

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-prune-issue-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Backlog上に存在する課題は残し、存在しない.mdファイルのみ削除すること', async () => {
    server.respond('/api/v2/issues', {body: [issue('TEST-1', '残る課題')]})

    await fs.mkdir(join(outputDir, '2026'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', '残る課題.md'), '# 残る課題')
    await fs.writeFile(join(outputDir, '2026', '削除された課題.md'), '# 削除された課題')

    const pruned = await pruneIssues(issuePruneDeps(), {outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '2026', '残る課題.md'))).to.be.true
    expect(existsSync(join(outputDir, '2026', '削除された課題.md'))).to.be.false
  })

  it('issueKeyFileName/issueKeyFolder設定の命名を再現して比較すること', async () => {
    server.respond('/api/v2/issues', {body: [issue('TEST-1', '課題A')]})

    await fs.mkdir(join(outputDir, '2026', 'TEST-1'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', 'TEST-1', 'TEST-1.md'), '# 課題A')
    await fs.mkdir(join(outputDir, '2026', 'TEST-9'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', 'TEST-9', 'TEST-9.md'), '# 削除済み課題')

    const pruned = await pruneIssues(issuePruneDeps(), {
      issueKeyFileName: true,
      issueKeyFolder: true,
      outputDir,
      projectId: PROJECT_ID,
    })

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '2026', 'TEST-1', 'TEST-1.md')), '現存課題は残ること').to.be.true
    expect(existsSync(join(outputDir, '2026', 'TEST-9')), '空になった課題キーフォルダは削除されること').to.be.false
  })

  it('課題が100件を超える場合はページングで全件を取得すること', async () => {
    server.respond('/api/v2/issues', (url) => {
      const offset = Number(url.searchParams.get('offset'))
      return offset === 0
        ? {body: Array.from({length: 100}, (_, i) => issue(`TEST-${i}`, `課題${i}`))}
        : {body: [issue('TEST-100', '課題100')]}
    })

    await fs.mkdir(join(outputDir, '2026'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', '課題100.md'), '# 課題100')
    await fs.writeFile(join(outputDir, '2026', 'orphan.md'), '# 削除対象')

    const pruned = await pruneIssues(issuePruneDeps(), {outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '2026', '課題100.md')), '2ページ目の課題も保護されること').to.be.true
    expect(existsSync(join(outputDir, '2026', 'orphan.md'))).to.be.false
  })

  it('課題一覧の取得に失敗した場合は、誤削除防止のため何も削除せずにエラーで中断すること', async () => {
    server.respond('/api/v2/issues', {status: 500})

    await fs.mkdir(join(outputDir, '2026'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', 'orphan.md'), '# 本来は削除対象')

    let thrown: unknown
    try {
      await pruneIssues(issuePruneDeps(), {outputDir, projectId: PROJECT_ID})
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.instanceOf(Error)
    expect((thrown as Error).message).to.include('誤削除を防ぐため')
    expect(existsSync(join(outputDir, '2026', 'orphan.md')), '中断時は何も削除しないこと').to.be.true
  })
})
