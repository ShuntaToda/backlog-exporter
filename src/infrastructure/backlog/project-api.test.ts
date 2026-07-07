import nock from 'nock'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BacklogHttpClient} from './http-client.js'
import {getProjectIdFromKey, validateAndGetProjectId} from './project-api.js'

describe('project-api', () => {
  const domain = 'example.backlog.jp'
  const apiKey = 'dummy-api-key'
  const projectKey = 'TEST'
  const projectId = 12_345

  const client = new BacklogHttpClient({apiKey, domain})

  beforeEach(() => {
    nock.cleanAll()
  })

  afterEach(() => {
    // 未使用のnockがないことを確認
    expect(nock.isDone()).to.be.true
  })

  describe('getProjectIdFromKey', () => {
    it('プロジェクトキーからプロジェクトIDを正しく取得できること', async () => {
      nock(`https://${domain}`).get(`/api/v2/projects/${projectKey}`).query({apiKey}).reply(200, {
        id: projectId,
        name: 'テストプロジェクト',
        projectKey: 'TEST',
      })

      const result = await getProjectIdFromKey(client, projectKey)
      expect(result).to.equal(projectId)
    })

    it('APIエラー時に適切なエラーメッセージをスローすること', async () => {
      nock(`https://${domain}`)
        .get(`/api/v2/projects/${projectKey}`)
        .query({apiKey})
        .reply(404, {
          errors: [{message: 'プロジェクトが見つかりません'}],
        })

      try {
        await getProjectIdFromKey(client, projectKey)
        expect.fail('エラーがスローされるべきです')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.include(
          `プロジェクトキー "${projectKey}" からプロジェクトIDの取得に失敗しました`,
        )
      }
    })

    it('エラーメッセージにapiKeyが含まれないこと（マスクされること）', async () => {
      nock(`https://${domain}`).get(`/api/v2/projects/${projectKey}`).query({apiKey}).reply(404, {})

      try {
        await getProjectIdFromKey(client, projectKey)
        expect.fail('エラーがスローされるべきです')
      } catch (error) {
        expect((error as Error).message).to.not.include(apiKey)
      }
    })
  })

  describe('validateAndGetProjectId', () => {
    it('数値の文字列が渡された場合、数値に変換して返すこと', async () => {
      const result = await validateAndGetProjectId(client, projectId.toString())
      expect(result).to.equal(projectId)
    })

    it('プロジェクトキーが渡された場合、APIを呼び出してIDを取得すること', async () => {
      nock(`https://${domain}`).get(`/api/v2/projects/${projectKey}`).query({apiKey}).reply(200, {
        id: projectId,
        name: 'テストプロジェクト',
        projectKey: 'TEST',
      })

      const result = await validateAndGetProjectId(client, projectKey)
      expect(result).to.equal(projectId)
    })
  })
})
