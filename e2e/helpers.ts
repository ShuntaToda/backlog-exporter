import {runCommand} from '@oclif/test'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import process from 'node:process'

export {BacklogMockServer} from '../src/shared/testing/backlog-mock-server.js'

export const API_KEY = 'e2e-dummy-key'
export const PROJECT_KEY = 'TEST'
export const PROJECT_ID = 12_345

// ユーザー環境の実APIキーをE2Eが拾わないように固定する
process.env.BACKLOG_API_KEY = API_KEY

// ビルド済みdistのコマンドをプロセス内で実行する
export function runCli(args: string[]) {
  return runCommand(args, {root: process.cwd()})
}

export async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), prefix))
}

export async function writeSettings(directory: string, settings: Record<string, unknown>): Promise<void> {
  await fs.mkdir(directory, {recursive: true})
  await fs.writeFile(join(directory, 'backlog-settings.json'), JSON.stringify(settings, null, 2))
}

export function issuePayload(overrides: Record<string, unknown> = {}) {
  return {
    assignee: null,
    created: '2026-01-02T00:00:00Z',
    customFields: [],
    description: '課題の本文',
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
  }
}

export function documentPayload(id: string, title: string, plain: string) {
  return {
    attachments: [],
    created: '2026-01-01T00:00:00Z',
    createdUser: {id: 1, name: '作成者'},
    id,
    json: '{}',
    plain,
    statusId: 1,
    tags: [],
    title,
    updated: '2026-01-02T00:00:00Z',
    updatedUser: {id: 1, name: '更新者'},
  }
}
