import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'

describe('Issueコマンド - 基本機能', () => {
  describe('フラグ定義', () => {
    it('必須フラグがすべて定義されていること', () => {
      const {flags} = Issue

      expect(flags.domain).to.exist
      expect(flags.domain.required).to.be.true
      expect(flags.projectIdOrKey).to.exist
      expect(flags.projectIdOrKey.required).to.be.true
    })

    it('オプションフラグが正しく設定されていること', () => {
      const {flags} = Issue

      expect(flags.apiKey).to.exist
      expect(flags.apiKey.required).to.be.false
      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
      expect(flags.maxCount).to.exist
      expect(flags.maxCount.required).to.be.false
      expect(flags.output).to.exist
      expect(flags.output.required).to.be.false
      expect(flags.statusId).to.exist
      expect(flags.statusId.required).to.be.false
    })

    it('maxCountフラグが適切な設定を持つこと', () => {
      const {flags} = Issue

      expect(flags.maxCount.default).to.equal(5000)
      expect(flags.maxCount.char).to.equal('m')
    })

    it('outputフラグに短縮オプション文字が設定されていること', () => {
      const {flags} = Issue

      expect(flags.output.char).to.equal('o')
    })
  })

  describe('コマンド説明', () => {
    it('descriptionが定義されていること', () => {
      expect(Issue.description).to.be.a('string')
      expect(Issue.description).to.include('課題')
      expect(Issue.description).to.include('Markdown')
    })
  })

  describe('使用例', () => {
    it('豊富な使用例が存在すること', () => {
      const {examples} = Issue

      expect(examples).to.be.an('array')
      expect(examples.length).to.be.greaterThan(5) // 7つの使用例がある

      const hasBasicExample = examples.some(
        (ex) => ex.includes('--apiKey') && !ex.includes('--statusId') && !ex.includes('--maxCount'),
      )
      const hasOutputExample = examples.some((ex) => ex.includes('--output'))
      const hasStatusIdExample = examples.some((ex) => ex.includes('--statusId'))
      const hasMaxCountExample = examples.some((ex) => ex.includes('--maxCount'))
      const hasIssueKeyFileNameExample = examples.some((ex) => ex.includes('--issueKeyFileName'))
      const hasIssueKeyFolderExample = examples.some((ex) => ex.includes('--issueKeyFolder'))

      expect(hasBasicExample).to.be.true
      expect(hasOutputExample).to.be.true
      expect(hasStatusIdExample).to.be.true
      expect(hasMaxCountExample).to.be.true
      expect(hasIssueKeyFileNameExample).to.be.true
      expect(hasIssueKeyFolderExample).to.be.true
    })

    it('すべての使用例が必須パラメータを含むこと', () => {
      const {examples} = Issue

      for (const example of examples) {
        expect(example).to.include('--domain')
        expect(example).to.include('--projectIdOrKey')
      }
    })

    it('課題固有のオプション組み合わせ例が存在すること', () => {
      const {examples} = Issue

      const hasCombinationExample = examples.some(
        (ex) => ex.includes('--issueKeyFileName') && ex.includes('--issueKeyFolder'),
      )

      expect(hasCombinationExample).to.be.true
    })
  })

  describe('フラグの詳細設定', () => {
    it('apiKeyフラグの説明に環境変数についての言及があること', () => {
      const {flags} = Issue

      expect(flags.apiKey.description).to.include('環境変数')
      expect(flags.apiKey.description).to.include('BACKLOG_API_KEY')
    })

    it('domainフラグの説明にドメイン例が含まれていること', () => {
      const {flags} = Issue

      expect(flags.domain.description).to.include('example.backlog.jp')
    })

    it('statusIdフラグの説明にカンマ区切りについての言及があること', () => {
      const {flags} = Issue

      expect(flags.statusId.description).to.include('カンマ')
    })

    it('maxCountフラグの説明にデフォルト値の言及があること', () => {
      const {flags} = Issue

      expect(flags.maxCount.description).to.include('5000')
    })
  })

  describe('課題固有フラグ', () => {
    it('issueKeyFileNameフラグが正しく設定されていること', () => {
      const {flags} = Issue

      expect(flags.issueKeyFileName.description).to.include('ファイル名')
      expect(flags.issueKeyFileName.description).to.include('課題キー')
    })

    it('issueKeyFolderフラグが正しく設定されていること', () => {
      const {flags} = Issue

      expect(flags.issueKeyFolder.description).to.include('フォルダ')
      expect(flags.issueKeyFolder.description).to.include('課題キー')
    })
  })

  describe('デフォルト設定', () => {
    it('maxCountのデフォルト値が適切に設定されていること', () => {
      const {flags} = Issue

      expect(flags.maxCount.default).to.equal(5000)
    })
  })
})
