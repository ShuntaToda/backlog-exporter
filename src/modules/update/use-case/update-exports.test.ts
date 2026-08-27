import {existsSync} from 'node:fs'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {createBacklogRepositories} from '../../../composition/backlog-repositories.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {stubLogger} from '../../../shared/testing/stub-logger.js'
import {updateExports} from './update-exports.js'

const API_KEY = 'test-api-key'
const PROJECT_KEY = 'TEST'
const PROJECT_ID = 12_345

describe('updateExports - downloadAttachmentsの伝播', () => {
  const server = new BacklogMockServer()
  let targetDir: string

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(async () => {
    server.reset()
    targetDir = await fs.mkdtemp(join(tmpdir(), 'backlog-update-test-'))
    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: PROJECT_ID, projectKey: PROJECT_KEY}})
    // ドキュメントのツリーの補完に使う一覧APIは既定で空にしておく
    server.respond('/api/v2/documents', {body: []})
  })

  afterEach(async () => {
    await fs.rm(targetDir, {force: true, recursive: true})
  })

  const writeSettings = async (settings: Record<string, unknown>) => {
    await fs.writeFile(
      join(targetDir, 'backlog-settings.json'),
      JSON.stringify({domain: server.domain, projectIdOrKey: PROJECT_KEY, ...settings}),
    )
  }

  const runUpdate = (flags: Record<string, unknown> = {}) =>
    updateExports({createRepositories: createBacklogRepositories, logger: stubLogger}, targetDir, {
      apiKey: API_KEY,
      force: true,
      ...flags,
    })

  it('設定ファイルのdownloadAttachmentsがWikiの添付ダウンロードに伝播すること', async () => {
    await writeSettings({downloadAttachments: true, folderType: 'wiki'})
    const binary = new Uint8Array([1, 2, 3, 4])
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {
      body: {attachments: [{id: 9, name: 'design.png', size: 4}], content: '本文', id: '111', name: 'WikiA'},
    })
    server.respond('/api/v2/wikis/111/attachments/9', {body: binary})

    await runUpdate()

    const saved = await fs.readFile(join(targetDir, 'attachments', 'WikiA', '9_design.png'))
    expect(new Uint8Array(saved)).to.deep.equal(binary)
    const content = await fs.readFile(join(targetDir, 'WikiA.md'), 'utf8')
    expect(content).to.include('- [design.png](./attachments/WikiA/9_design.png)')
  })

  it('--downloadAttachmentsフラグがドキュメントの添付ダウンロードに伝播すること', async () => {
    await writeSettings({folderType: 'document'})
    const binary = new Uint8Array([5, 6])
    server.respond('/api/v2/documents/tree', {
      body: {activeTree: {children: [{children: [], id: 'docA', name: 'ドキュメントA'}], id: 'root'}},
    })
    server.respond('/api/v2/documents/docA', {
      body: {
        attachments: [
          {created: '2026-01-01T00:00:00Z', createdUser: {id: 1, name: '作成者'}, id: 77, name: 'log.txt', size: 2},
        ],
        created: '2026-01-01T00:00:00Z',
        createdUser: {id: 1, name: '作成者'},
        id: 'docA',
        json: '{}',
        plain: '本文',
        statusId: 1,
        tags: [],
        title: 'ドキュメントA',
        updated: '2026-01-02T00:00:00Z',
        updatedUser: {id: 1, name: '更新者'},
      },
    })
    server.respond('/api/v2/documents/docA/attachments/77', {body: binary})

    await runUpdate({downloadAttachments: true})

    expect(existsSync(join(targetDir, 'attachments', 'ドキュメントA', '77_log.txt'))).to.be.true
    const content = await fs.readFile(join(targetDir, 'ドキュメントA.md'), 'utf8')
    expect(content).to.include('- [log.txt](./attachments/ドキュメントA/77_log.txt)')
  })

  it('フラグも設定もない場合は添付をダウンロードしないこと', async () => {
    await writeSettings({folderType: 'wiki'})
    server.respond('/api/v2/wikis', {body: [{id: '111', name: 'WikiA', updated: '2026-01-02T00:00:00Z'}]})
    server.respond('/api/v2/wikis/111', {
      body: {attachments: [{id: 9, name: 'design.png', size: 4}], content: '本文', id: '111', name: 'WikiA'},
    })

    await runUpdate()

    expect(server.requestedPaths()).to.not.include('/api/v2/wikis/111/attachments/9')
    expect(existsSync(join(targetDir, 'attachments'))).to.be.false
  })
})
