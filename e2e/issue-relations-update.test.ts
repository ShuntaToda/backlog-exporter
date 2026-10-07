import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {API_KEY, BacklogMockServer, issuePayload, makeTempDir, PROJECT_ID, PROJECT_KEY, runCli} from './helpers.js'

interface IssueSpec {
  id: number
  parentIssueId?: number
  summary: string
  updated?: string
}

const BASELINE = '2026-06-01T00:00:00Z'
const CHANGED = '2026-07-01T00:00:00Z'
// 初回エクスポート後のファイルに付ける目印。update後に残っていれば書き直されていない
const MARKER = '<!-- e2e: 初回エクスポート時の内容 -->'

const server = new BacklogMockServer()
let outputDir: string
let backlogIssues: IssueSpec[] = []
let logLengthAfterExport = 0

const issueKey = (id: number) => `TEST-${id}`
const issueLink = (id: number, summary: string) => `[${issueKey(id)} ${summary}](${server.domain}/view/${issueKey(id)})`
const issueFile = (id: number) => join(outputDir, '2026', `${issueKey(id)}.md`)
const readIssue = (id: number) => fs.readFile(issueFile(id), 'utf8')

function toPayload(spec: IssueSpec) {
  return issuePayload({
    id: spec.id,
    issueKey: issueKey(spec.id),
    parentIssueId: spec.parentIssueId ?? null,
    summary: spec.summary,
    updated: spec.updated ?? '2026-01-03T00:00:00Z',
  })
}

function serveIssues(specs: IssueSpec[]): void {
  backlogIssues = specs
  server.respond('/api/v2/issues', (url) => {
    const ids = url.searchParams.getAll('id[]').map(Number)
    const parentIds = url.searchParams.getAll('parentIssueId[]').map(Number)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const count = Number(url.searchParams.get('count') ?? 100)
    const matched = backlogIssues
      .filter((spec) => ids.length === 0 || ids.includes(spec.id))
      .filter(
        (spec) =>
          parentIds.length === 0 || (spec.parentIssueId !== undefined && parentIds.includes(spec.parentIssueId)),
      )
    return {body: matched.slice(offset, offset + count).map((spec) => toPayload(spec))}
  })
  for (const spec of specs) {
    server.respond(`/api/v2/issues/${issueKey(spec.id)}`, () => ({
      body: toPayload(backlogIssues.find((current) => current.id === spec.id)!),
    }))
    server.respond(`/api/v2/issues/${issueKey(spec.id)}/comments`, {body: []})
  }
}

async function exportInitialIssues(specs: IssueSpec[]): Promise<void> {
  serveIssues(specs)
  const {error} = await runCli([
    'issue',
    '--domain',
    server.domain,
    '--projectIdOrKey',
    PROJECT_KEY,
    '--apiKey',
    API_KEY,
    '--output',
    outputDir,
    '--issueKeyFileName',
  ])
  expect(error).to.be.undefined

  const settingsPath = join(outputDir, 'backlog-settings.json')
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))
  await fs.writeFile(settingsPath, JSON.stringify({...settings, lastUpdated: BASELINE}, null, 2))

  for (const spec of specs) {
    // eslint-disable-next-line no-await-in-loop
    await fs.appendFile(issueFile(spec.id), `\n${MARKER}\n`)
  }

  logLengthAfterExport = (await fs.readFile(join(outputDir, 'backlog-update.log'), 'utf8')).length
}

function runUpdate(...extraArgs: string[]) {
  return runCli(['update', outputDir, '--force', '--apiKey', API_KEY, ...extraArgs])
}

async function rewrittenIds(): Promise<number[]> {
  const ids: number[] = []
  for (const spec of backlogIssues) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await readIssue(spec.id)).includes(MARKER)) ids.push(spec.id)
  }

  return ids
}

// oclifは警告を端末幅で折り返すため、空白と折り返し記号を除いて比較する
const unwrap = (text: string) => text.replaceAll(/[\s›]+/g, '')

async function saveCount(id: number): Promise<number> {
  const log = (await fs.readFile(join(outputDir, 'backlog-update.log'), 'utf8')).slice(logLengthAfterExport)
  return log.split('\n').filter((line) => line.endsWith(`/view/${issueKey(id)}`)).length
}

beforeAll(() => server.start())
afterAll(() => server.stop())

beforeEach(async () => {
  server.reset()
  server.respond(`/api/v2/projects/${PROJECT_KEY}`, {body: {id: PROJECT_ID}})
  outputDir = await makeTempDir('backlog-e2e-issue-relations-')
})

afterEach(async () => {
  await fs.rm(outputDir, {force: true, recursive: true})
})

describe('updateコマンドでの課題の親子関係', () => {
  it('子課題が追加されたら親課題に新しい子が載り、兄弟の課題は書き直さないこと', async () => {
    await exportInitialIssues([
      {id: 10, summary: '親課題'},
      {id: 11, parentIssueId: 10, summary: '既存の子課題'},
    ])
    serveIssues([...backlogIssues, {id: 12, parentIssueId: 10, summary: '新しい子課題', updated: CHANGED}])

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    const parent = await readIssue(10)
    expect(parent).to.include(`- ${issueLink(11, '既存の子課題')}`)
    expect(parent).to.include(`- ${issueLink(12, '新しい子課題')}`)
    expect(await readIssue(12)).to.include(`- 親課題: ${issueLink(10, '親課題')}`)
    expect(await rewrittenIds()).to.have.members([10, 12])
  })

  it('親課題の件名が変わったら子課題に新しい件名が載ること', async () => {
    await exportInitialIssues([
      {id: 10, summary: '旧親課題'},
      {id: 11, parentIssueId: 10, summary: '子課題'},
    ])
    serveIssues([{id: 10, summary: '新親課題', updated: CHANGED}, backlogIssues[1]])

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    expect(await readIssue(11)).to.include(`- 親課題: ${issueLink(10, '新親課題')}`)
    expect(await rewrittenIds()).to.have.members([10, 11])
  })

  it('子課題の件名が変わったら親課題に新しい件名が載ること', async () => {
    await exportInitialIssues([
      {id: 10, summary: '親課題'},
      {id: 11, parentIssueId: 10, summary: '旧子課題'},
    ])
    serveIssues([backlogIssues[0], {id: 11, parentIssueId: 10, summary: '新子課題', updated: CHANGED}])

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    const parent = await readIssue(10)
    expect(parent).to.include(`- ${issueLink(11, '新子課題')}`)
    expect(parent).to.not.include('旧子課題')
    expect(await rewrittenIds()).to.have.members([10, 11])
  })

  it('3階層以上で中間の課題が更新されたら直接の親と子だけを書き直すこと', async () => {
    await exportInitialIssues([
      {id: 1, summary: '第1階層'},
      {id: 2, parentIssueId: 1, summary: '第2階層'},
      {id: 3, parentIssueId: 2, summary: '第3階層'},
      {id: 4, parentIssueId: 3, summary: '第4階層'},
      {id: 5, parentIssueId: 4, summary: '第5階層'},
    ])
    serveIssues(
      backlogIssues.map((spec) => (spec.id === 3 ? {...spec, summary: '改名した第3階層', updated: CHANGED} : spec)),
    )

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    expect(await readIssue(2)).to.include(`- ${issueLink(3, '改名した第3階層')}`)
    expect(await readIssue(4)).to.include(`- 親課題: ${issueLink(3, '改名した第3階層')}`)
    expect(await rewrittenIds()).to.have.members([2, 3, 4])
  })

  it('更新された課題と親子関係のない課題は書き直さないこと', async () => {
    await exportInitialIssues([
      {id: 10, summary: '単独の課題'},
      {id: 20, summary: '無関係な親課題'},
      {id: 21, parentIssueId: 20, summary: '無関係な子課題'},
    ])
    serveIssues(backlogIssues.map((spec) => (spec.id === 10 ? {...spec, updated: CHANGED} : spec)))

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    expect(await rewrittenIds()).to.have.members([10])
  })

  it('--issueIdOrKey指定時は指定した課題だけを書き直すこと', async () => {
    await exportInitialIssues([
      {id: 10, summary: '旧親課題'},
      {id: 11, parentIssueId: 10, summary: '対象の課題'},
      {id: 12, parentIssueId: 11, summary: '旧孫課題'},
    ])
    serveIssues([
      {id: 10, summary: '新親課題', updated: CHANGED},
      {id: 11, parentIssueId: 10, summary: '対象の課題'},
      {id: 12, parentIssueId: 11, summary: '新孫課題', updated: CHANGED},
    ])

    const {error} = await runUpdate('--issueIdOrKey', issueKey(11))

    expect(error).to.be.undefined
    const target = await readIssue(11)
    expect(target).to.include(`- 親課題: ${issueLink(10, '新親課題')}`)
    expect(target).to.include(`- ${issueLink(12, '新孫課題')}`)
    expect(await rewrittenIds()).to.have.members([11])
    const settings = JSON.parse(await fs.readFile(join(outputDir, 'backlog-settings.json'), 'utf8'))
    expect(settings.lastUpdated).to.equal(BASELINE)
  })

  it('親課題と子課題が両方とも更新されたらそれぞれ1回だけ保存すること', async () => {
    await exportInitialIssues([
      {id: 10, summary: '旧親課題'},
      {id: 11, parentIssueId: 10, summary: '旧子課題'},
    ])
    serveIssues([
      {id: 10, summary: '新親課題', updated: CHANGED},
      {id: 11, parentIssueId: 10, summary: '新子課題', updated: CHANGED},
    ])

    const {error} = await runUpdate()

    expect(error).to.be.undefined
    expect(await readIssue(10)).to.include(`- ${issueLink(11, '新子課題')}`)
    expect(await readIssue(11)).to.include(`- 親課題: ${issueLink(10, '新親課題')}`)
    expect(await saveCount(10)).to.equal(1)
    expect(await saveCount(11)).to.equal(1)
  })

  it('親子の表示を揃えるだけの書き直しはコメント取得に失敗したら見送り、既存のファイルを残すこと', async () => {
    await exportInitialIssues([
      {id: 10, summary: '親課題'},
      {id: 11, parentIssueId: 10, summary: '旧子課題'},
      {id: 12, parentIssueId: 11, summary: '孫課題'},
    ])
    const parentBeforeUpdate = await readIssue(10)
    serveIssues([
      backlogIssues[0],
      {id: 11, parentIssueId: 10, summary: '新子課題', updated: CHANGED},
      backlogIssues[2],
    ])
    server.respond(`/api/v2/issues/${issueKey(10)}/comments`, {status: 500})

    const {error, stderr} = await runUpdate()

    expect(error).to.be.undefined
    expect(unwrap(stderr)).to.include(
      unwrap(`課題 ${issueKey(10)} のコメント取得に失敗したため、親子の表示の更新を見送りました`),
    )
    expect(await readIssue(10)).to.equal(parentBeforeUpdate)
    expect(await readIssue(11)).to.include('# 新子課題')
    expect(await readIssue(12), 'コメントを取得できた課題は書き直すこと').to.include(
      `- 親課題: ${issueLink(11, '新子課題')}`,
    )
    expect(await rewrittenIds()).to.have.members([11, 12])
  })

  it('更新された課題自身はコメント取得に失敗しても保存すること', async () => {
    await exportInitialIssues([
      {id: 10, summary: '親課題'},
      {id: 11, parentIssueId: 10, summary: '旧子課題'},
    ])
    serveIssues([backlogIssues[0], {id: 11, parentIssueId: 10, summary: '新子課題', updated: CHANGED}])
    server.respond(`/api/v2/issues/${issueKey(11)}/comments`, {status: 404})

    const {error, stderr} = await runUpdate()

    expect(error).to.be.undefined
    expect(unwrap(stderr)).to.include(unwrap(`課題 ${issueKey(11)} のコメント取得に失敗しました`))
    const updated = await readIssue(11)
    expect(updated).to.include('# 新子課題')
    expect(updated).to.not.include(MARKER)
  })
})
