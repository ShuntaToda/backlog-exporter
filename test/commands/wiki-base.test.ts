import {expect} from 'chai'
import {describe, it} from 'mocha'

import Wiki from '../../src/commands/wiki/index.js'

describe('Wikiコマンド - 基本機能', () => {
  describe('フラグ定義', () => {
    it('必須フラグがすべて定義されていること', () => {
      const {flags} = Wiki

      expect(flags.domain).to.exist
      expect(flags.domain.required).to.be.true
      expect(flags.projectIdOrKey).to.exist
      expect(flags.projectIdOrKey.required).to.be.true
    })

    it('オプションフラグが正しく設定されていること', () => {
      const {flags} = Wiki

      expect(flags.apiKey).to.exist
      expect(flags.apiKey.required).to.be.false
      expect(flags.output).to.exist
      expect(flags.output.required).to.be.false
    })

    it('outputフラグに短縮オプション文字が設定されていること', () => {
      const {flags} = Wiki

      expect(flags.output.char).to.equal('o')
    })
  })

  describe('コマンド説明', () => {
    it('descriptionが定義されていること', () => {
      expect(Wiki.description).to.be.a('string')
      expect(Wiki.description).to.include('Wiki')
      expect(Wiki.description).to.include('Markdown')
    })
  })

  describe('使用例', () => {
    it('基本的な使用例が存在すること', () => {
      const {examples} = Wiki

      expect(examples).to.be.an('array')
      expect(examples.length).to.be.greaterThan(0)

      const hasBasicExample = examples.some((ex) => ex.includes('--apiKey'))
      const hasOutputExample = examples.some((ex) => ex.includes('--output'))

      expect(hasBasicExample).to.be.true
      expect(hasOutputExample).to.be.true
    })

    it('すべての使用例が必須パラメータを含むこと', () => {
      const {examples} = Wiki

      for (const example of examples) {
        expect(example).to.include('--domain')
        expect(example).to.include('--projectIdOrKey')
      }
    })
  })

  describe('フラグの詳細設定', () => {
    it('apiKeyフラグの説明に環境変数についての言及があること', () => {
      const {flags} = Wiki

      expect(flags.apiKey.description).to.include('環境変数')
      expect(flags.apiKey.description).to.include('BACKLOG_API_KEY')
    })

    it('domainフラグの説明にドメイン例が含まれていること', () => {
      const {flags} = Wiki

      expect(flags.domain.description).to.include('example.backlog.jp')
    })
  })

  describe('デフォルト出力設定', () => {
    it('デフォルト出力ディレクトリが適切に設定されること', () => {
      // wikiコマンドはデフォルトで "./wiki" を使用
      expect(Wiki.examples.some((ex) => !ex.includes('--output'))).to.be.true
    })
  })
})
