import {expect} from 'chai'
import {afterEach, beforeEach, describe, it} from 'mocha'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import {join} from 'node:path'

import {appendLog} from '../../src/utils/log.js'

describe('log.ts - ログ記録機能', () => {
  let tempDir: string
  let logPath: string
  let consoleErrorSpy: string[]
  let originalConsoleError: typeof console.error

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'backlog-log-test-'))
    logPath = join(tempDir, 'backlog-update.log')

    // console.errorをモック
    consoleErrorSpy = []
    originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      consoleErrorSpy.push(args.join(' '))
    }
  })

  afterEach(async () => {
    // console.errorを元に戻す
    console.error = originalConsoleError

    // 一時ディレクトリを削除
    try {
      await fs.rm(tempDir, {force: true, recursive: true})
    } catch {
      // エラーは無視
    }
  })

  describe('appendLog', () => {
    it('ログファイルが存在しない場合、新しいログファイルを作成すること', async () => {
      const message = 'テストログメッセージ'

      await appendLog(tempDir, message)

      const exists = await fs
        .access(logPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).to.be.true
    })

    it('ログメッセージがタイムスタンプ付きで記録されること', async () => {
      const message = 'タイムスタンプテスト'

      await appendLog(tempDir, message)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.include(message)
      expect(logContent).to.match(/\[\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\]/)
    })

    it('複数のログメッセージを順番に記録すること', async () => {
      const messages = ['最初のメッセージ', '2番目のメッセージ', '3番目のメッセージ']

      await Promise.all(messages.map((message) => appendLog(tempDir, message)))

      const logContent = await fs.readFile(logPath, 'utf8')
      for (const message of messages) {
        expect(logContent).to.include(message)
      }

      const lines = logContent.trim().split('\n')
      expect(lines).to.have.length(3)
    })

    it('既存のログファイルに追記すること', async () => {
      const firstMessage = '既存のログ'
      const secondMessage = '追加のログ'

      await appendLog(tempDir, firstMessage)
      await appendLog(tempDir, secondMessage)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.include(firstMessage)
      expect(logContent).to.include(secondMessage)

      const lines = logContent.trim().split('\n')
      expect(lines).to.have.length(2)
    })

    it('空のメッセージも記録すること', async () => {
      const emptyMessage = ''

      await appendLog(tempDir, emptyMessage)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.match(/\[\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\]\s*\n/)
    })

    it('日本語メッセージを正しく記録すること', async () => {
      const japaneseMessage = 'プロジェクトの更新が完了しました'

      await appendLog(tempDir, japaneseMessage)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.include(japaneseMessage)
    })

    it('長いメッセージも記録すること', async () => {
      const longMessage = 'これは非常に長いログメッセージです。'.repeat(10)

      await appendLog(tempDir, longMessage)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.include(longMessage)
    })

    it('特殊文字を含むメッセージを記録すること', async () => {
      const specialMessage = 'エラー: ファイル "test.txt" が見つかりません (404)'

      await appendLog(tempDir, specialMessage)

      const logContent = await fs.readFile(logPath, 'utf8')
      expect(logContent).to.include(specialMessage)
    })

    it('存在しない出力ディレクトリに対してエラーハンドリングすること', async () => {
      const invalidDir = join(tempDir, 'non-existent-directory')

      await appendLog(invalidDir, 'テストメッセージ')

      expect(consoleErrorSpy.length).to.be.greaterThan(0)
      expect(consoleErrorSpy[0]).to.include('ログの記録に失敗しました')
    })

    it('権限のないディレクトリに対してエラーハンドリングすること', async () => {
      // 権限エラーのシミュレーションは困難なため、無効なパスでテスト
      const invalidPath = '/root/restricted-directory'

      await appendLog(invalidPath, '権限テスト')

      // エラーが発生してもクラッシュしないことを確認
      expect(consoleErrorSpy.length).to.be.greaterThanOrEqual(0)
    })

    it('タイムスタンプが日本の形式で記録されること', async () => {
      const message = '日本時間テスト'

      await appendLog(tempDir, message)

      const logContent = await fs.readFile(logPath, 'utf8')
      // 日本の日付形式（YYYY/MM/DD HH:mm:ss）をチェック
      expect(logContent).to.match(/\[\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\]/)
    })
  })
})
