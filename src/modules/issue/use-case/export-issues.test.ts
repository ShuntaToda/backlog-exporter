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

  it('issueIdOrKeys指定時は該当課題のみを取得し、一覧APIを呼ばないこと', async () => {
    server.respond('/api/v2/issues/TEST-2', {
      body: issue({description: '指定取得の本文', id: 2, issueKey: 'TEST-2', summary: '指定課題'}),
    })
    server.respond('/api/v2/issues/TEST-2/comments', {body: []})

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
    expect(server.requestedPaths()).to.not.include('/api/v2/issues')
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
})
