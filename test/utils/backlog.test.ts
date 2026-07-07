import nock from 'nock'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {getProjectIdFromKey, validateAndGetProjectId} from '../../src/utils/backlog.js'

describe('backlog utility functions', () => {
  const domain = 'example.backlog.jp'
  const apiKey = 'dummy-api-key'
  const projectKey = 'TEST'
  const projectId = 12_345

  beforeEach(() => {
    // テスト前にnockをクリーンアップ
    nock.cleanAll()
  })

  afterEach(() => {
    // 未使用のnockがないことを確認
    expect(nock.isDone()).to.be.true
  })

  describe('getProjectIdFromKey', () => {
    it('プロジェクトキーからプロジェクトIDを正しく取得できること', async () => {
      // APIレスポンスをモック
      nock(`https://${domain}`).get(`/api/v2/projects/${projectKey}`).query({apiKey}).reply(200, {
        id: projectId,
        name: 'テストプロジェクト',
        projectKey: 'TEST',
      })

      const result = await getProjectIdFromKey(domain, projectKey, apiKey)
      expect(result).to.equal(projectId)
    })

    it('APIエラー時に適切なエラーメッセージをスローすること', async () => {
      // APIエラーをモック
      nock(`https://${domain}`)
        .get(`/api/v2/projects/${projectKey}`)
        .query({apiKey})
        .reply(404, {
          errors: [{message: 'プロジェクトが見つかりません'}],
        })

      try {
        await getProjectIdFromKey(domain, projectKey, apiKey)
        // エラーがスローされなかった場合はテスト失敗
        expect.fail('エラーがスローされるべきです')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.include(
          `プロジェクトキー "${projectKey}" からプロジェクトIDの取得に失敗しました`,
        )
      }
    })
  })

  describe('validateAndGetProjectId', () => {
    it('数値の文字列が渡された場合、数値に変換して返すこと', async () => {
      const result = await validateAndGetProjectId(domain, projectId.toString(), apiKey)
      expect(result).to.equal(projectId)
    })

    it('プロジェクトキーが渡された場合、APIを呼び出してIDを取得すること', async () => {
      // APIレスポンスをモック
      nock(`https://${domain}`).get(`/api/v2/projects/${projectKey}`).query({apiKey}).reply(200, {
        id: projectId,
        name: 'テストプロジェクト',
        projectKey: 'TEST',
      })

      const result = await validateAndGetProjectId(domain, projectKey, apiKey)
      expect(result).to.equal(projectId)
    })
  })
})
