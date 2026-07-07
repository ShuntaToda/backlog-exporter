import {expect} from 'chai'
import nock from 'nock'
import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {pruneDocuments} from '../../src/utils/backlog-api.js'

// pruneDocuments は oclif の Command に依存するが、log/warn しか使わないためスタブで十分
const stubCommand = {
  log() {},
  warn() {},
} as never

const DOMAIN = 'example.backlog.jp'
const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345

describe('pruneDocuments（不要なローカルドキュメントの削除）', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-prune-test-'))
  })

  afterEach(async () => {
    nock.cleanAll()
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  it('Backlog上に存在するファイルは残し、存在しない.mdファイルのみ削除すること', async () => {
    // Backlogツリー: docA のみ存在（docB は削除済み想定）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {children: [{children: [], id: 'da', name: 'docA'}], id: 'root'},
      })

    // ドキュメント一覧（title はツリーの name と同じ）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [{id: 'da', title: 'docA'}])

    // ローカルに docA.md（残るべき）と docB.md（削除されるべき）を用意
    await fs.writeFile(join(outputDir, 'docA.md'), '# docA')
    await fs.writeFile(join(outputDir, 'docB.md'), '# docB(削除済み)')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'docA.md')), 'docA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'docB.md')), 'docB.md は削除されること').to.be.false
  })

  it('ツリーのnameと詳細のtitleが異なる場合でも、title基準で保存されたファイルを誤削除しないこと', async () => {
    // ツリー上の name は "旧タイトル" だが、詳細APIの title は "新タイトル"
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {children: [{children: [], id: 'dx', name: '旧タイトル'}], id: 'root'},
      })

    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [{id: 'dx', title: '新タイトル'}])

    // 実際の保存時は title 由来のファイル名になるため、"新タイトル.md" がローカルにある
    await fs.writeFile(join(outputDir, '新タイトル.md'), '# 新タイトル')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    // title 基準で期待パスを構築するため、誤って削除されない
    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, '新タイトル.md')), '新タイトル.md は残ること').to.be.true
  })

  it('設定ファイルや.md以外のユーザーファイルには触れないこと', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {activeTree: {children: [], id: 'root'}})

    await fs.writeFile(join(outputDir, 'backlog-settings.json'), '{}')
    await fs.writeFile(join(outputDir, 'backlog-update.log'), 'log')
    await fs.writeFile(join(outputDir, 'note.txt'), 'user file')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'backlog-settings.json')), '設定ファイルは保護').to.be.true
    expect(existsSync(join(outputDir, 'backlog-update.log')), 'ログは保護').to.be.true
    expect(existsSync(join(outputDir, 'note.txt')), '.md以外は保護').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除').to.be.false
  })

  it('移動されたドキュメントの旧パスを削除し、空になったディレクトリも削除すること', async () => {
    // Backlogツリー: docM は「新フォルダ」配下に存在（旧フォルダからは消えた想定）
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {
          children: [{children: [{children: [], id: 'dm', name: 'docM'}], id: 'f-new', name: '新フォルダ'}],
          id: 'root',
        },
      })

    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [{id: 'dm', title: 'docM'}])

    // ローカルには旧フォルダ配下にだけ docM.md が残っている
    await fs.mkdir(join(outputDir, '旧フォルダ'), {recursive: true})
    await fs.writeFile(join(outputDir, '旧フォルダ', 'docM.md'), '# docM(旧パス)')
    // 新パスにも保存済みとする（pruneの対象外）
    await fs.mkdir(join(outputDir, '新フォルダ'), {recursive: true})
    await fs.writeFile(join(outputDir, '新フォルダ', 'docM.md'), '# docM(新パス)')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, '旧フォルダ', 'docM.md')), '旧パスのファイルは削除').to.be.false
    expect(existsSync(join(outputDir, '旧フォルダ')), '空になった旧フォルダは削除').to.be.false
    expect(existsSync(join(outputDir, '新フォルダ', 'docM.md')), '新パスのファイルは残る').to.be.true
  })

  it('ドキュメント一覧の取得に失敗した場合は、誤削除防止のため何も削除せずにエラーで中断すること', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {children: [{children: [], id: 'da', name: 'docA'}], id: 'root'},
      })

    // 一時的なサーバーエラーを想定（kyのリトライ分も含めて常に500を返す）
    nock(`https://${DOMAIN}`)
      .persist()
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(500)

    await fs.writeFile(join(outputDir, 'docA.md'), '# docA')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 本来は削除対象')

    let thrown: unknown
    try {
      await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})
    } catch (error) {
      thrown = error
    }

    expect(thrown, '詳細取得の失敗でエラーになること').to.be.instanceOf(Error)
    expect(existsSync(join(outputDir, 'docA.md')), 'docA.md は残ること').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), '中断時は削除対象のファイルにも触れないこと').to.be.true
  })

  it('子を持たない空フォルダ（ドキュメント一覧に現れない）はフォルダとして扱い、対応する空ディレクトリを残すこと', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {children: [{children: [], id: 'f-empty', name: '空フォルダ'}], id: 'root'},
      })

    // フォルダはドキュメント一覧には含まれない
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [])

    await fs.mkdir(join(outputDir, '空フォルダ'), {recursive: true})

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, '空フォルダ')), 'Backlog上に存在する空フォルダは残ること').to.be.true
  })

  it('タイトルの大文字小文字のみが変わった場合に、旧表記のままのローカルファイルを誤削除しないこと', async () => {
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {
        activeTree: {children: [{children: [], id: 'dr', name: 'README'}], id: 'root'},
      })

    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [{id: 'dr', title: 'README'}])

    // 大文字小文字を区別しないファイルシステムでは、タイトル変更後もディスク上のエントリ名は旧表記のまま残る
    await fs.writeFile(join(outputDir, 'Readme.md'), '# Readme')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(0)
    expect(existsSync(join(outputDir, 'Readme.md')), '大文字小文字違いのファイルは残ること').to.be.true
  })

  it('ドキュメントが100件を超える場合はページングで全件のタイトルを取得すること', async () => {
    // 101件のドキュメント（一覧APIは100件/ページなので2ページに分かれる）
    const treeChildren = Array.from({length: 101}, (_, i) => ({children: [], id: `d${i}`, name: `doc${i}`}))
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents/tree')
      .query({apiKey: API_KEY, projectIdOrKey: String(PROJECT_ID)})
      .reply(200, {activeTree: {children: treeChildren, id: 'root'}})

    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '0', 'projectId[]': String(PROJECT_ID)})
      .reply(
        200,
        Array.from({length: 100}, (_, i) => ({id: `d${i}`, title: `doc${i}`})),
      )
    nock(`https://${DOMAIN}`)
      .get('/api/v2/documents')
      .query({apiKey: API_KEY, count: '100', offset: '100', 'projectId[]': String(PROJECT_ID)})
      .reply(200, [{id: 'd100', title: 'doc100'}])

    // 2ページ目のドキュメントに対応するファイルと、削除対象のファイルを用意
    await fs.writeFile(join(outputDir, 'doc100.md'), '# doc100')
    await fs.writeFile(join(outputDir, 'orphan.md'), '# 削除対象')

    const pruned = await pruneDocuments(stubCommand, {apiKey: API_KEY, domain: DOMAIN, outputDir, projectId: PROJECT_ID})

    expect(pruned).to.equal(1)
    expect(existsSync(join(outputDir, 'doc100.md')), '2ページ目のドキュメントも保護されること').to.be.true
    expect(existsSync(join(outputDir, 'orphan.md')), 'orphan.md は削除されること').to.be.false
  })
})
