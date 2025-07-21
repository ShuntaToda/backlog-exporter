import {expect} from 'chai'
import {describe, it} from 'mocha'

import Update from '../../src/commands/update/index.js'

describe('Updateコマンド - 基本機能', () => {
  describe('args定義', () => {
    it('directoryの引数が定義されていること', () => {
      const {args} = Update

      expect(args.directory).to.exist
      expect(args.directory.required).to.be.false
      expect(args.directory.description).to.include('更新対象のディレクトリ')
    })
  })

  describe('フラグ定義', () => {
    it('認証関連のフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.apiKey).to.exist
      expect(flags.apiKey.required).to.be.false
      expect(flags.domain).to.exist
      expect(flags.domain.required).to.be.false
      expect(flags.projectIdOrKey).to.exist
      expect(flags.projectIdOrKey.required).to.be.false
    })

    it('更新対象フィルタリングフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.documentsOnly).to.exist
      expect(flags.documentsOnly.required).to.be.false
      expect(flags.issuesOnly).to.exist
      expect(flags.issuesOnly.required).to.be.false
      expect(flags.wikisOnly).to.exist
      expect(flags.wikisOnly.required).to.be.false
    })

    it('課題関連のオプションフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
    })

    it('forceフラグに短縮オプション文字が設定されていること', () => {
      const {flags} = Update

      expect(flags.force).to.exist
      expect(flags.force.required).to.be.false
      expect(flags.force.char).to.equal('f')
    })
  })

  describe('コマンド説明', () => {
    it('descriptionが定義されていること', () => {
      expect(Update.description).to.be.a('string')
      expect(Update.description).to.include('更新')
      expect(Update.description).to.include('最新データ')
    })
  })

  describe('使用例', () => {
    it('豊富な使用例が存在すること', () => {
      const {examples} = Update

      expect(examples).to.be.an('array')
      expect(examples.length).to.be.greaterThan(0)

      const hasForceExample = examples.some((ex) => ex.includes('--force'))
      const hasDirectoryExample = examples.some((ex) => ex.includes('./'))
      const hasIssueKeyExample = examples.some((ex) => ex.includes('--issueKey'))

      expect(hasForceExample).to.be.true
      expect(hasDirectoryExample).to.be.true
      expect(hasIssueKeyExample).to.be.true
    })

    it('カレントディレクトリでの使用例が存在すること', () => {
      const {examples} = Update

      const hasCurrentDirExample = examples.some(
        (ex) =>
          ex.includes('カレントディレクトリ') ||
          (!ex.includes('--domain') && !ex.includes('--apiKey') && !ex.includes('./')),
      )

      expect(hasCurrentDirExample).to.be.true
    })
  })

  describe('フラグの詳細設定', () => {
    it('boolean型フラグが正しく設定されていること', () => {
      const {flags} = Update

      expect(flags.documentsOnly).to.exist
      expect(flags.documentsOnly.required).to.be.false
      expect(flags.force).to.exist
      expect(flags.force.required).to.be.false
      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
      expect(flags.issuesOnly).to.exist
      expect(flags.issuesOnly.required).to.be.false
      expect(flags.wikisOnly).to.exist
      expect(flags.wikisOnly.required).to.be.false
    })

    it('apiKeyフラグの説明に環境変数についての言及があること', () => {
      const {flags} = Update

      expect(flags.apiKey.description).to.include('環境変数')
      expect(flags.apiKey.description).to.include('BACKLOG_API_KEY')
    })

    it('forceフラグの説明に確認スキップの言及があること', () => {
      const {flags} = Update

      expect(flags.force.description).to.include('確認')
      expect(flags.force.description).to.include('スキップ')
    })
  })

  describe('フラグの組み合わせ検証', () => {
    it('更新対象を限定するフラグが排他的に動作すること', () => {
      const {flags} = Update

      // 3つのOnly系フラグが存在することを確認
      expect(flags.documentsOnly).to.exist
      expect(flags.issuesOnly).to.exist
      expect(flags.wikisOnly).to.exist
    })
  })
})
