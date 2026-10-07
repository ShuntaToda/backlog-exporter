import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BODY_END_MARKER, BODY_START_MARKER} from '../../../shared/markdown/body-marker.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {newBacklogIssueRepository} from '../repository/backlog-issue-repository.js'
import {exportIssues} from './export-issues.js'

const API_KEY = 'test-api-key'
const PROJECT_ID = 12_345

const BODY_WITH_HEADING = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'

const issue = (overrides: Record<string, unknown> = {}) => ({
  assignee: null,
  category: [],
  created: '2026-01-02T00:00:00Z',
  customFields: [],
  description: '本文',
  dueDate: null,
  id: 1,
  issueKey: 'TEST-1',
  issueType: {id: 1, name: 'タスク'},
  parentIssueId: null,
  priority: {id: 2, name: '中'},
  startDate: null,
  status: {id: 1, name: '未対応'},
  summary: 'テスト課題',
  updated: '2026-01-03T00:00:00Z',
  ...overrides,
})

describe('exportIssues', () => {
  const server = new BacklogMockServer()
  let outputDir: string

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(async () => {
    server.reset()
    outputDir = await fs.mkdtemp(join(tmpdir(), 'backlog-issues-test-'))
  })

  afterEach(async () => {
    await fs.rm(outputDir, {force: true, recursive: true})
  })

  const client = () => new BacklogHttpClient({apiKey: API_KEY, domain: server.domain})

  it('課題の詳細（本文）がマーカーで囲まれて保存されること', async () => {
    server.respond('/api/v2/issues', {body: [issue({description: BODY_WITH_HEADING})]})
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include(`${BODY_START_MARKER}\n${BODY_WITH_HEADING}\n${BODY_END_MARKER}`)
    expect(content).to.include('# テスト課題')
    expect(content).to.include('- 課題キー: TEST-1')
  })

  it('コメントがコメントリンク付きで保存されること', async () => {
    server.respond('/api/v2/issues', {body: [issue({summary: 'コメント付き課題'})]})
    server.respond('/api/v2/issues/TEST-1/comments', {
      body: [
        {
          content: 'コメント本文',
          created: '2026-01-02T10:00:00Z',
          createdUser: {id: 1, name: 'コメント投稿者'},
          id: 999,
        },
        {
          changeLog: [{field: 'assigner', newValue: '山田', originalValue: null}],
          content: null,
          created: '2026-01-03T10:00:00Z',
          createdUser: {id: 2, name: '変更者'},
          id: 1000,
        },
      ],
    })

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'コメント付き課題.md'), 'utf8')
    expect(content).to.include('## コメント')
    expect(content).to.include('コメント本文')
    expect(content).to.include(`[Backlog Comment Link](${server.domain}/view/TEST-1#comment-999)`)
    expect(content, '担当者変更の通知が変更内容として記載されること').to.include('- 担当者: 未設定 → 山田')
  })

  it('issueIdOrKeys指定時は該当課題のみを取得し、プロジェクト全体の一覧を取得しないこと', async () => {
    server.respond('/api/v2/issues/TEST-2', {
      body: issue({description: '指定取得の本文', id: 2, issueKey: 'TEST-2', summary: '指定課題'}),
    })
    server.respond('/api/v2/issues/TEST-2/comments', {body: []})
    server.respond('/api/v2/issues', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        issueIdOrKeys: ['TEST-2'],
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', '指定課題.md'), 'utf8')
    expect(content).to.include('指定取得の本文')
    // 一覧APIは子課題の補完にのみ使う。projectId[]を伴う全件取得は行わない
    expect(server.requests.filter((request) => request.searchParams.has('projectId[]'))).to.deep.equal([])
  })

  it('downloadAttachments指定時に添付ファイルを保存し、Markdownにローカルリンクを記載すること', async () => {
    const binary = new Uint8Array([1, 2, 3, 4])
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 10, name: 'design.png', size: 2048}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})
    server.respond('/api/v2/issues/TEST-1/attachments/10', {body: binary})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const saved = await fs.readFile(join(outputDir, '2026', 'attachments', 'TEST-1', '10_design.png'))
    expect(new Uint8Array(saved)).to.deep.equal(binary)

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('## 添付ファイル')
    expect(content).to.include('- [design.png](./attachments/TEST-1/10_design.png) (2.0 KB)')
  })

  it('issueKeyFolder指定時は課題フォルダ直下のattachmentsに保存すること', async () => {
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 11, name: 'log.txt', size: 512}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})
    server.respond('/api/v2/issues/TEST-1/attachments/11', {body: new Uint8Array([5, 6])})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        issueKeyFolder: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    await fs.access(join(outputDir, '2026', 'TEST-1', 'attachments', '11_log.txt'))

    const content = await fs.readFile(join(outputDir, '2026', 'TEST-1', 'テスト課題.md'), 'utf8')
    expect(content).to.include('- [log.txt](./attachments/11_log.txt) (0.5 KB)')
  })

  it('本文とコメント内の添付画像記法をローカルリンクに変換すること', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({
          attachments: [{id: 10, name: 'design.png', size: 2048}],
          description: '説明\n![image][design.png]',
        }),
      ],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {
      body: [
        {
          content: 'コメント画像\n#image(design.png)',
          created: '2026-01-02T10:00:00Z',
          createdUser: {id: 1, name: '投稿者'},
          id: 999,
        },
      ],
    })
    server.respond('/api/v2/issues/TEST-1/attachments/10', {body: new Uint8Array([1])})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('説明\n![design.png](./attachments/TEST-1/10_design.png)')
    expect(content).to.include('コメント画像\n![design.png](./attachments/TEST-1/10_design.png)')
    expect(content).to.not.include('![image][design.png]')
  })

  it('downloadAttachments未指定時は画像記法を変換しないこと', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({
          attachments: [{id: 10, name: 'design.png', size: 2048}],
          description: '![image][design.png]',
        }),
      ],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('![image][design.png]')
  })

  it('ダウンロード済みの添付ファイルは再ダウンロードしないこと', async () => {
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 10, name: 'design.png', size: 2}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    const existingPath = join(outputDir, '2026', 'attachments', 'TEST-1', '10_design.png')
    await fs.mkdir(join(outputDir, '2026', 'attachments', 'TEST-1'), {recursive: true})
    await fs.writeFile(existingPath, new Uint8Array([9, 9]))

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(server.requestedPaths()).to.not.include('/api/v2/issues/TEST-1/attachments/10')
    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content, 'スキップした添付にもリンクが付くこと').to.include('(./attachments/TEST-1/10_design.png)')
  })

  it('サイズの一致しない既存ファイル（破損）は再ダウンロードすること', async () => {
    const binary = new Uint8Array([1, 2, 3, 4])
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 10, name: 'design.png', size: 4}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})
    server.respond('/api/v2/issues/TEST-1/attachments/10', {body: binary})

    const existingPath = join(outputDir, '2026', 'attachments', 'TEST-1', '10_design.png')
    await fs.mkdir(join(outputDir, '2026', 'attachments', 'TEST-1'), {recursive: true})
    await fs.writeFile(existingPath, new Uint8Array([9]))

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(server.requestedPaths()).to.include('/api/v2/issues/TEST-1/attachments/10')
    const saved = await fs.readFile(existingPath)
    expect(new Uint8Array(saved)).to.deep.equal(binary)
  })

  it('添付ファイルの取得に失敗しても課題本体は保存し、リンクなしで記載すること', async () => {
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 12, name: 'broken.pdf', size: 1024}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})
    server.respond('/api/v2/issues/TEST-1/attachments/12', {status: 404})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        downloadAttachments: true,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('- broken.pdf (1.0 KB)')
    expect(content).to.not.include('](./attachments')
  })

  it('downloadAttachments未指定時はダウンロードせず、メタデータのみ記載すること', async () => {
    server.respond('/api/v2/issues', {
      body: [issue({attachments: [{id: 10, name: 'design.png', size: 2048}]})],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(server.requestedPaths()).to.not.include('/api/v2/issues/TEST-1/attachments/10')
    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('- design.png (2.0 KB)')
  })

  it('projectId[]パラメータ付きで課題一覧を取得すること', async () => {
    server.respond('/api/v2/issues', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(server.requests[0].searchParams.get('projectId[]')).to.equal(String(PROJECT_ID))
  })

  it('カテゴリーが基本情報に記載されること', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({
          category: [
            {id: 1, name: '設計'},
            {id: 2, name: '実装'},
          ],
        }),
      ],
    })
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('- カテゴリー: 設計, 実装')
  })

  it('カテゴリー未設定の課題は「未設定」と記載されること', async () => {
    server.respond('/api/v2/issues', {body: [issue()]})
    server.respond('/api/v2/issues/TEST-1/comments', {body: []})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', 'テスト課題.md'), 'utf8')
    expect(content).to.include('- カテゴリー: 未設定')
  })

  it('プロジェクト全体の取得では追加APIなしで親課題・子課題が記載されること', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({id: 10, issueKey: 'TEST-10', summary: '親課題'}),
        issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '子課題A'}),
        issue({id: 12, issueKey: 'TEST-12', parentIssueId: 10, summary: '子課題B'}),
      ],
    })
    for (const issueKey of ['TEST-10', 'TEST-11', 'TEST-12']) {
      server.respond(`/api/v2/issues/${issueKey}/comments`, {body: []})
    }

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const parent = await fs.readFile(join(outputDir, '2026', '親課題.md'), 'utf8')
    expect(parent).to.include('## 子課題')
    expect(parent).to.include(`- [TEST-11 子課題A](${server.domain}/view/TEST-11)`)
    expect(parent).to.include(`- [TEST-12 子課題B](${server.domain}/view/TEST-12)`)
    expect(parent, '親を持たない課題には親課題の行を出さないこと').to.not.include('- 親課題:')

    const child = await fs.readFile(join(outputDir, '2026', '子課題A.md'), 'utf8')
    expect(child).to.include(`- 親課題: [TEST-10 親課題](${server.domain}/view/TEST-10)`)
    expect(child, '子を持たない課題には子課題セクションを出さないこと').to.not.include('## 子課題')

    expect(
      server.requests.filter((request) => request.searchParams.has('parentIssueId[]')),
      'プロジェクト全体の取得では子課題を引くための追加APIを呼ばないこと',
    ).to.deep.equal([])
  })

  it('issueIdOrKeys指定時は親課題・子課題をAPIで補完すること', async () => {
    server.respond('/api/v2/issues/TEST-11', {
      body: issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '子課題A'}),
    })
    server.respond('/api/v2/issues/TEST-11/comments', {body: []})
    server.respond('/api/v2/issues', (url) => {
      if (url.searchParams.getAll('parentIssueId[]').includes('11')) {
        return {body: [issue({id: 20, issueKey: 'TEST-20', parentIssueId: 11, summary: '孫課題'})]}
      }

      if (url.searchParams.getAll('id[]').includes('10')) {
        return {body: [issue({id: 10, issueKey: 'TEST-10', summary: '親課題'})]}
      }

      return {body: []}
    })

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        issueIdOrKeys: ['TEST-11'],
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', '子課題A.md'), 'utf8')
    expect(content).to.include(`- 親課題: [TEST-10 親課題](${server.domain}/view/TEST-10)`)
    expect(content).to.include(`- [TEST-20 孫課題](${server.domain}/view/TEST-20)`)
    expect(
      await fs.readdir(join(outputDir, '2026')),
      '補完に使った親子の課題はファイルとして書き直さないこと',
    ).to.have.members(['子課題A.md'])
  })

  it('複数の課題を指定しても親課題・子課題の取得はそれぞれ1回にまとめること', async () => {
    for (const [id, summary] of [
      [11, '子課題A'],
      [12, '子課題B'],
    ] as const) {
      server.respond(`/api/v2/issues/TEST-${id}`, {
        body: issue({id, issueKey: `TEST-${id}`, parentIssueId: 10, summary}),
      })
      server.respond(`/api/v2/issues/TEST-${id}/comments`, {body: []})
    }

    server.respond('/api/v2/issues', (url) =>
      url.searchParams.getAll('id[]').includes('10')
        ? {body: [issue({id: 10, issueKey: 'TEST-10', summary: '親課題'})]}
        : {body: []},
    )

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        issueIdOrKeys: ['TEST-11', 'TEST-12'],
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const children = server.requests.filter((request) => request.searchParams.has('parentIssueId[]'))
    expect(children, '子課題は対象課題をまとめて1回で引くこと').to.have.length(1)
    expect(children[0].searchParams.getAll('parentIssueId[]')).to.deep.equal(['11', '12'])

    const parents = server.requests.filter((request) => request.searchParams.has('id[]'))
    expect(parents, '同じ親は重複を除いて1回で引くこと').to.have.length(1)
    expect(parents[0].searchParams.getAll('id[]')).to.deep.equal(['10'])
  })

  it('親課題の取得に失敗しても課題本体を保存し、IDのみ記載すること', async () => {
    server.respond('/api/v2/issues/TEST-11', {
      body: issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '子課題A'}),
    })
    server.respond('/api/v2/issues/TEST-11/comments', {body: []})
    server.respond('/api/v2/issues', (url) => (url.searchParams.has('id[]') ? {status: 404} : {body: []}))

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        issueIdOrKeys: ['TEST-11'],
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const content = await fs.readFile(join(outputDir, '2026', '子課題A.md'), 'utf8')
    expect(content).to.include('- 親課題: (ID: 10)')
    expect(content).to.include('# 子課題A')
  })

  it('3階層（親・子・孫）の課題がそれぞれ1つ上と1つ下を参照できること', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({id: 10, issueKey: 'TEST-10', summary: '親課題'}),
        issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '子課題'}),
        issue({id: 12, issueKey: 'TEST-12', parentIssueId: 11, summary: '孫課題'}),
      ],
    })
    for (const issueKey of ['TEST-10', 'TEST-11', 'TEST-12']) {
      server.respond(`/api/v2/issues/${issueKey}/comments`, {body: []})
    }

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const parent = await fs.readFile(join(outputDir, '2026', '親課題.md'), 'utf8')
    expect(parent).to.not.include('- 親課題:')
    expect(parent).to.include(`- [TEST-11 子課題](${server.domain}/view/TEST-11)`)
    expect(parent, '孫課題は直接の子ではないため親課題には出さないこと').to.not.include('TEST-12')

    const child = await fs.readFile(join(outputDir, '2026', '子課題.md'), 'utf8')
    expect(child, '2階層目は親課題と子課題の両方を持つこと').to.include(
      `- 親課題: [TEST-10 親課題](${server.domain}/view/TEST-10)`,
    )
    expect(child).to.include(`- [TEST-12 孫課題](${server.domain}/view/TEST-12)`)

    const grandchild = await fs.readFile(join(outputDir, '2026', '孫課題.md'), 'utf8')
    expect(grandchild).to.include(`- 親課題: [TEST-11 子課題](${server.domain}/view/TEST-11)`)
    expect(grandchild, '子を持たない3階層目には子課題セクションを出さないこと').to.not.include('## 子課題')
  })

  it('lastUpdated指定時は更新された課題の直接の親と子も書き直すこと', async () => {
    server.respond('/api/v2/issues', {
      body: [
        issue({id: 10, issueKey: 'TEST-10', summary: '親課題'}),
        issue({id: 11, issueKey: 'TEST-11', parentIssueId: 10, summary: '既存の子課題'}),
        issue({
          id: 12,
          issueKey: 'TEST-12',
          parentIssueId: 10,
          summary: '新しい子課題',
          updated: '2026-02-01T00:00:00Z',
        }),
        issue({id: 20, issueKey: 'TEST-20', summary: '改名した親課題', updated: '2026-02-01T00:00:00Z'}),
        issue({id: 21, issueKey: 'TEST-21', parentIssueId: 20, summary: '改名した親の子課題'}),
        issue({id: 30, issueKey: 'TEST-30', summary: '無関係な課題'}),
      ],
    })
    for (const issueKey of ['TEST-10', 'TEST-11', 'TEST-12', 'TEST-20', 'TEST-21', 'TEST-30']) {
      server.respond(`/api/v2/issues/${issueKey}/comments`, {body: []})
    }

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        lastUpdated: '2026-01-15T00:00:00Z',
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    const parent = await fs.readFile(join(outputDir, '2026', '親課題.md'), 'utf8')
    expect(parent, '子が追加された親は更新日時が変わらなくても書き直すこと').to.include(
      `- [TEST-12 新しい子課題](${server.domain}/view/TEST-12)`,
    )
    expect(parent, '書き直しても既存の子を残すこと').to.include(
      `- [TEST-11 既存の子課題](${server.domain}/view/TEST-11)`,
    )

    const child = await fs.readFile(join(outputDir, '2026', '改名した親の子課題.md'), 'utf8')
    expect(child, '更新された親の子は新しい件名を参照すること').to.include(
      `- 親課題: [TEST-20 改名した親課題](${server.domain}/view/TEST-20)`,
    )

    const savedFiles = await fs.readdir(join(outputDir, '2026'))
    expect(savedFiles, '更新された課題の兄弟や無関係な課題は書き直さないこと').to.have.members([
      '親課題.md',
      '新しい子課題.md',
      '改名した親課題.md',
      '改名した親の子課題.md',
    ])
  })

  it('親子の表示を揃えるための書き直しはコメント取得に失敗したら見送り、既存のファイルを残すこと', async () => {
    await fs.mkdir(join(outputDir, '2026'), {recursive: true})
    await fs.writeFile(join(outputDir, '2026', '親課題.md'), '既存の内容')

    server.respond('/api/v2/issues', {
      body: [
        issue({id: 10, issueKey: 'TEST-10', summary: '親課題'}),
        issue({
          id: 11,
          issueKey: 'TEST-11',
          parentIssueId: 10,
          summary: '新しい子課題',
          updated: '2026-02-01T00:00:00Z',
        }),
      ],
    })
    server.respond('/api/v2/issues/TEST-10/comments', {status: 404})
    server.respond('/api/v2/issues/TEST-11/comments', {status: 404})

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        lastUpdated: '2026-01-15T00:00:00Z',
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(await fs.readFile(join(outputDir, '2026', '親課題.md'), 'utf8')).to.equal('既存の内容')
    expect(
      await fs.readFile(join(outputDir, '2026', '新しい子課題.md'), 'utf8'),
      '更新された課題はコメント取得に失敗しても保存すること',
    ).to.include(`- 親課題: [TEST-10 親課題](${server.domain}/view/TEST-10)`)
  })

  it('親子の表示を揃えるために書き直す課題の親も取得済み集合になければ補完すること', async () => {
    server.respond('/api/v2/issues', (url) => {
      if (url.searchParams.getAll('id[]').includes('999')) {
        return {body: [issue({id: 999, issueKey: 'OTHER-1', summary: '別プロジェクトの親課題'})]}
      }

      return {
        body: [
          issue({id: 10, issueKey: 'TEST-10', parentIssueId: 999, summary: '親課題'}),
          issue({
            id: 11,
            issueKey: 'TEST-11',
            parentIssueId: 10,
            summary: '新しい子課題',
            updated: '2026-02-01T00:00:00Z',
          }),
        ],
      }
    })
    for (const issueKey of ['TEST-10', 'TEST-11']) {
      server.respond(`/api/v2/issues/${issueKey}/comments`, {body: []})
    }

    await exportIssues(
      {issueRepository: newBacklogIssueRepository(client()), logger: stubLogger},
      {
        domain: server.domain,
        lastUpdated: '2026-01-15T00:00:00Z',
        outputDir,
        projectId: PROJECT_ID,
      },
    )

    expect(await fs.readFile(join(outputDir, '2026', '親課題.md'), 'utf8')).to.include(
      `- 親課題: [OTHER-1 別プロジェクトの親課題](${server.domain}/view/OTHER-1)`,
    )
  })
})
