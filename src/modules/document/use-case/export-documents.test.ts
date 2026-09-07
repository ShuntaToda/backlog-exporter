import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {createRecordingLogger, stubLogger} from '../../../shared/testing/stub-logger.js'
import {newBacklogDocumentRepository} from '../repository/backlog-document-repository.js'
import {exportDocuments} from './export-documents.js'

const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345
const PROJECT_KEY = 'TEST'

const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const documentDetail = (id: string, title: string, plain: string, json?: unknown) => ({
  attachments: [],
  created: '2026-01-01T00:00:00Z',
  createdUser: {id: 1, name: '作成者'},
  id,
  json: json ?? {content: [], type: 'doc'},
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
    // ツリーの補完に使う一覧APIは既定で空にしておき、必要なテストだけ上書きする
    respondDocumentList([])
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

  const respondTree = (children: unknown[], trashChildren: unknown[] = []) => {
    server.respond('/api/v2/documents/tree', {
      body: {
        activeTree: {children, id: 'root'},
        projectId: PROJECT_ID,
        trashTree: {children: trashChildren, id: 'trash'},
      },
    })
  }

  const respondDocumentList = (documents: Array<{id: string; title: string}>) => {
    server.respond('/api/v2/documents', {body: documents})
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

  it('本文はplainではなくjsonの構造から生成されること', async () => {
    // plainは改行が失われた状態で返ることがある（今回の不具合）
    const collapsedPlain = '見出し本文1本文2項目'
    const json = {
      content: [
        {attrs: {level: 2}, content: [{text: '見出し', type: 'text'}], type: 'heading'},
        {content: [{text: '本文1', type: 'text'}], type: 'paragraph'},
        {content: [{text: '本文2', type: 'text'}], type: 'paragraph'},
        {
          content: [{content: [{content: [{text: '項目', type: 'text'}], type: 'paragraph'}], type: 'listItem'}],
          type: 'bulletList',
        },
      ],
      type: 'doc',
    }
    respondTree([{children: [], id: 'd1', name: 'ドキュメントA'}])
    server.respond('/api/v2/documents/d1', {body: documentDetail('d1', 'ドキュメントA', collapsedPlain, json)})

    await exportDocuments(
      {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
      exportOptions(),
    )

    const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n## 見出し\n\n本文1\n\n本文2\n\n- 項目\n${BODY_END_MARKER}`)
    expect(content, '1行に潰れたplainは使われないこと').to.not.include(collapsedPlain)
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
    it('plainが空でもjsonに画像だけある親は 00_index.md を作成すること', async () => {
      // 画像のみ・表のみの本文はplainが空になるため、json由来の本文で判定する必要がある
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {
        body: documentDetail('parent1', '親フォルダ', '', {
          content: [{attrs: {src: '/document/foo.png'}, type: 'image'}],
          type: 'doc',
        }),
      })
      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', '子A', '子の本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      const indexPath = join(outputDir, '親フォルダ', '00_index.md')
      expect(existsSync(indexPath), '画像のみの親でもindexが作られること').to.be.true
      const content = await fs.readFile(indexPath, 'utf8')
      expect(content).to.include('![](/document/foo.png)')
    })

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

  describe('ツリーに現れないドキュメント', () => {
    it('一覧APIにしか存在しないドキュメントを出力ルート直下に保存すること', async () => {
      respondTree([{children: [], id: 'd1', name: 'ツリー内'}])
      respondDocumentList([
        {id: 'd1', title: 'ツリー内'},
        {id: 'd2', title: 'ツリー外'},
      ])
      server.respond('/api/v2/documents/d1', {body: documentDetail('d1', 'ツリー内', 'ツリー内の本文')})
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', 'ツリー外', 'ツリー外の本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      const content = await fs.readFile(join(outputDir, 'ツリー外.md'), 'utf8')
      expect(content).to.include('ツリー外の本文')
      expect(existsSync(join(outputDir, 'ツリー内.md')), 'ツリー内のドキュメントも従来どおり保存されること').to.be.true
    })

    it('フォルダ配下のドキュメントを二重に保存しないこと', async () => {
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      respondDocumentList([
        {id: 'childA', title: '子A'},
        {id: 'parent1', title: '親フォルダ'},
      ])
      server.respond('/api/v2/documents/parent1', {body: documentDetail('parent1', '親フォルダ', '親の本文')})
      server.respond('/api/v2/documents/childA', {body: documentDetail('childA', '子A', 'A本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      expect(existsSync(join(outputDir, '親フォルダ', '子A.md')), 'ツリー上の位置に保存されること').to.be.true
      expect(existsSync(join(outputDir, '子A.md')), '出力ルート直下には保存されないこと').to.be.false
      expect(existsSync(join(outputDir, '親フォルダ.md')), '親ドキュメントも重複保存されないこと').to.be.false
    })

    it('ルート直下のツリー内ドキュメントと同名の場合、上書きせず警告すること', async () => {
      respondTree([{children: [], id: 'd1', name: '同じ名前'}])
      respondDocumentList([
        {id: 'd1', title: '同じ名前'},
        {id: 'd2', title: '同じ名前'},
      ])
      server.respond('/api/v2/documents/d1', {body: documentDetail('d1', '同じ名前', 'ツリー内の本文')})
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', '同じ名前', 'ツリー外の本文')})

      const logger = createRecordingLogger()
      await exportDocuments({documentRepository: newBacklogDocumentRepository(client()), logger}, exportOptions())

      const content = await fs.readFile(join(outputDir, '同じ名前.md'), 'utf8')
      expect(content, 'ツリー内のドキュメントの内容が残ること').to.include('ツリー内の本文')
      expect(content, 'ツリー外のドキュメントで上書きされないこと').to.not.include('ツリー外の本文')
      expect(logger.warnings.join('\n'), '黙って捨てずに警告すること').to.include(
        'ツリーに現れないドキュメント「同じ名前」',
      )
    })

    it('ツリーに現れないドキュメント同士が同名の場合、後のドキュメントで上書きせず警告すること', async () => {
      respondTree([])
      respondDocumentList([
        {id: 'd2', title: '同じ名前'},
        {id: 'd3', title: '同じ名前'},
      ])
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', '同じ名前', '先に保存された本文')})
      server.respond('/api/v2/documents/d3', {body: documentDetail('d3', '同じ名前', '後のドキュメントの本文')})

      const logger = createRecordingLogger()
      await exportDocuments({documentRepository: newBacklogDocumentRepository(client()), logger}, exportOptions())

      const content = await fs.readFile(join(outputDir, '同じ名前.md'), 'utf8')
      expect(content, '先に保存された内容が残ること').to.include('先に保存された本文')
      expect(content, '後のドキュメントで上書きされないこと').to.not.include('後のドキュメントの本文')
      expect(logger.warnings.join('\n'), '黙って捨てずに警告すること').to.include(
        'ツリーに現れないドキュメント「同じ名前」',
      )
    })

    it('増分更新でも、未取得のままだったドキュメントを保存すること', async () => {
      respondTree([])
      respondDocumentList([{id: 'd2', title: 'ずっと未取得'}])
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', 'ずっと未取得', '半年前の本文')})

      // lastUpdated はドキュメントの updated(2026-01-02) より後 ＝ 更新日時だけ見ればスキップされる
      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({lastUpdated: '2026-06-01T00:00:00Z'}),
      )

      expect(existsSync(join(outputDir, 'ずっと未取得.md')), 'ローカルに無いファイルはバックフィルされること').to.be.true
    })

    it('増分更新で、取得済みかつ未更新のドキュメントは再取得しないこと', async () => {
      respondTree([])
      respondDocumentList([{id: 'd2', title: 'ツリー外'}])
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', 'ツリー外', '新しい本文')})

      await fs.writeFile(join(outputDir, 'ツリー外.md'), '# ツリー外\n\n取得済みの本文')

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({lastUpdated: '2026-06-01T00:00:00Z'}),
      )

      const content = await fs.readFile(join(outputDir, 'ツリー外.md'), 'utf8')
      expect(content, '既存ファイルは上書きされないこと').to.include('取得済みの本文')
    })

    it('ゴミ箱のドキュメントは復元しないこと', async () => {
      respondTree([], [{children: [], id: 'trashed', name: '削除済み'}])
      respondDocumentList([{id: 'trashed', title: '削除済み'}])

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      expect(existsSync(join(outputDir, '削除済み.md')), 'ゴミ箱のドキュメントは保存されないこと').to.be.false
      expect(server.requestedPaths()).to.not.include('/api/v2/documents/trashed')
    })

    it('一覧APIの取得に失敗しても、ツリー分のエクスポートは従来どおり完了すること', async () => {
      respondTree([{children: [], id: 'd1', name: 'ツリー内'}])
      server.respond('/api/v2/documents', {status: 403})
      server.respond('/api/v2/documents/d1', {body: documentDetail('d1', 'ツリー内', 'ツリー内の本文')})

      const logger = createRecordingLogger()
      await exportDocuments({documentRepository: newBacklogDocumentRepository(client()), logger}, exportOptions())

      expect(existsSync(join(outputDir, 'ツリー内.md')), 'ツリー分は保存されること').to.be.true
      expect(logger.warnings.join('\n')).to.include('ドキュメント一覧の取得に失敗した')
    })

    it('documentIdsで指定したドキュメントがツリーに無い場合も取得できること', async () => {
      respondTree([{children: [], id: 'd1', name: 'ツリー内'}])
      respondDocumentList([
        {id: 'd1', title: 'ツリー内'},
        {id: 'd2', title: 'ツリー外'},
      ])
      server.respond('/api/v2/documents/d2', {body: documentDetail('d2', 'ツリー外', 'ツリー外の本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({documentIds: ['d2']}),
      )

      expect(existsSync(join(outputDir, 'ツリー外.md')), '指定したドキュメントが保存されること').to.be.true
      expect(existsSync(join(outputDir, 'ツリー内.md')), '指定外は保存されないこと').to.be.false
    })

    it('documentIdsの対象がすべてツリー内にある場合は一覧APIを呼ばないこと', async () => {
      respondTree([{children: [], id: 'd1', name: 'ツリー内'}])
      server.respond('/api/v2/documents/d1', {body: documentDetail('d1', 'ツリー内', 'ツリー内の本文')})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({documentIds: ['d1']}),
      )

      expect(existsSync(join(outputDir, 'ツリー内.md'))).to.be.true
      expect(server.requestedPaths()).to.not.include('/api/v2/documents')
    })
  })

  describe('添付ファイルのダウンロード', () => {
    it('downloadAttachments指定時に添付を保存し、Markdownにローカルリンクを記載すること', async () => {
      const binary = new Uint8Array([1, 2, 3, 4])
      respondTree([{children: [], id: 'docA', name: 'ドキュメントA'}])
      server.respond('/api/v2/documents/docA', {
        body: {
          ...documentDetail('docA', 'ドキュメントA', '本文'),
          attachments: [
            {created: '2026-01-01T00:00:00Z', createdUser: {id: 1, name: '作成者'}, id: 77, name: 'design.png', size: 4},
          ],
        },
      })
      server.respond('/api/v2/documents/docA/attachments/77', {body: binary})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({downloadAttachments: true}),
      )

      const saved = await fs.readFile(join(outputDir, 'attachments', 'ドキュメントA', '77_design.png'))
      expect(new Uint8Array(saved)).to.deep.equal(binary)

      const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
      expect(content).to.include('- [design.png](./attachments/ドキュメントA/77_design.png) (0.0 KB) - 作成者: 作成者')
    })

    it('フォルダ配下のドキュメントの添付はフォルダ内のattachmentsに保存されること', async () => {
      respondTree([{children: [{children: [], id: 'childA', name: '子A'}], id: 'parent1', name: '親フォルダ'}])
      server.respond('/api/v2/documents/parent1', {body: documentDetail('parent1', '親フォルダ', '')})
      server.respond('/api/v2/documents/childA', {
        body: {
          ...documentDetail('childA', '子A', 'A本文'),
          attachments: [
            {created: '2026-01-01T00:00:00Z', createdUser: {id: 1, name: '作成者'}, id: 78, name: 'log.txt', size: 2},
          ],
        },
      })
      server.respond('/api/v2/documents/childA/attachments/78', {body: new Uint8Array([5, 6])})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({downloadAttachments: true}),
      )

      expect(existsSync(join(outputDir, '親フォルダ', 'attachments', '子A', '78_log.txt'))).to.be.true
      const content = await fs.readFile(join(outputDir, '親フォルダ', '子A.md'), 'utf8')
      expect(content).to.include('- [log.txt](./attachments/子A/78_log.txt)')
    })

    it('downloadAttachments指定時も本文中の参照はBacklogの原文のまま維持すること', async () => {
      const plain = [
        '説明',
        '![](/document/backend/TEST/docA/file/77){width="415" height="233" uuid="x" textAlign="center"}',
        '[attachmentBadge id="78" projectKey="TEST" documentId="docA" uuid="y" attachmentUrl="/document/backend/TEST/docA/file/78" filename="資料.pdf" size="2" created="2026-01-01T00:00:00Z"]',
      ].join('\n')
      respondTree([{children: [], id: 'docA', name: 'ドキュメントA'}])
      server.respond('/api/v2/documents/docA', {
        body: {
          ...documentDetail('docA', 'ドキュメントA', plain),
          attachments: [
            {created: '2026-01-01T00:00:00Z', createdUser: {id: 1, name: '作成者'}, id: 77, name: '図.png', size: 4},
            {created: '2026-01-01T00:00:00Z', createdUser: {id: 1, name: '作成者'}, id: 78, name: '資料.pdf', size: 2},
          ],
        },
      })
      server.respond('/api/v2/documents/docA/attachments/77', {body: new Uint8Array([1, 2, 3, 4])})
      server.respond('/api/v2/documents/docA/attachments/78', {body: new Uint8Array([5, 6])})

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions({downloadAttachments: true}),
      )

      const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
      expect(content, '本文は原文のまま').to.include(plain)
      expect(content, '添付セクションにはローカルリンクが付くこと').to.include(
        '- [図.png](./attachments/ドキュメントA/77_図.png)',
      )
    })

    it('downloadAttachments未指定時はダウンロードせず、メタデータのみ記載すること', async () => {
      respondTree([{children: [], id: 'docA', name: 'ドキュメントA'}])
      server.respond('/api/v2/documents/docA', {
        body: {
          ...documentDetail('docA', 'ドキュメントA', '本文'),
          attachments: [
            {
              created: '2026-01-01T00:00:00Z',
              createdUser: {id: 1, name: '作成者'},
              id: 77,
              name: 'design.png',
              size: 2048,
            },
          ],
        },
      })

      await exportDocuments(
        {documentRepository: newBacklogDocumentRepository(client()), logger: stubLogger},
        exportOptions(),
      )

      expect(server.requestedPaths()).to.not.include('/api/v2/documents/docA/attachments/77')
      const content = await fs.readFile(join(outputDir, 'ドキュメントA.md'), 'utf8')
      expect(content).to.include('- **design.png** (2.0 KB)')
      expect(content).to.not.include('](./attachments')
    })
  })
})
