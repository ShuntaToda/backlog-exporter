import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from '../../../shared/backlog/http-client.js'
import {BacklogMockServer} from '../../../shared/testing/backlog-mock-server.js'
import {newBacklogProjectRepository} from './backlog-project-repository.js'

const API_KEY = 'dummy-api-key'
const PROJECT_KEY = 'TEST'
const PROJECT_ID = 12_345

describe('BacklogProjectRepository', () => {
  const server = new BacklogMockServer()

  beforeAll(() => server.start())
  afterAll(() => server.stop())

  beforeEach(() => server.reset())

  const repository = () => newBacklogProjectRepository(new BacklogHttpClient({apiKey: API_KEY, domain: server.domain}))

  it('数値の文字列が渡された場合、APIを呼ばず数値に変換して返すこと', async () => {
    const result = await repository().resolveProjectId(PROJECT_ID.toString())
    expect(result).to.equal(PROJECT_ID)
    expect(server.requests).to.have.length(0)
  })

  it('プロジェクトキーが渡された場合、APIを呼び出してIDを取得すること', async () => {
    server.respond(`/api/v2/projects/${PROJECT_KEY}`, {
      body: {id: PROJECT_ID, name: 'テストプロジェクト', projectKey: PROJECT_KEY},
    })

    const result = await repository().resolveProjectId(PROJECT_KEY)
    expect(result).to.equal(PROJECT_ID)
  })

  it('APIエラー時に適切なエラーメッセージをスローすること（apiKeyはマスクされる）', async () => {
    try {
      await repository().resolveProjectId(PROJECT_KEY)
      expect.fail('エラーがスローされるべきです')
    } catch (error) {
      expect(error).to.be.instanceOf(Error)
      expect((error as Error).message).to.include(
        `プロジェクトキー "${PROJECT_KEY}" からプロジェクトIDの取得に失敗しました`,
      )
      expect((error as Error).message).to.not.include(API_KEY)
    }
  })
})
