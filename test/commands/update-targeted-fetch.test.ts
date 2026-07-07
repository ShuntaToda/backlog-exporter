import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'
import Update from '../../src/commands/update/index.js'

describe('特定項目のみ再取得するフラグ（update専用）', () => {
  describe('issueIdOrKeyフラグ', () => {
    it('フラグが定義されており、説明にカンマ区切りの言及があること', () => {
      const {flags} = Update

      expect(flags.issueIdOrKey).to.exist
      expect(flags.issueIdOrKey.required).to.be.false
      expect(flags.issueIdOrKey.description).to.include('課題')
      expect(flags.issueIdOrKey.description).to.include('カンマ')
    })

    it('使用例が存在すること', () => {
      const hasExample = Update.examples.some((ex) => ex.includes('--issueIdOrKey '))
      expect(hasExample).to.be.true
    })

    it('Issueコマンドには存在しないこと（update専用）', () => {
      const flags = Issue.flags as Record<string, unknown>
      expect(flags.issueIdOrKey).to.be.undefined
    })
  })

  describe('wikiIdフラグ', () => {
    it('フラグが定義されており、説明にカンマ区切りの言及があること', () => {
      const {flags} = Update

      expect(flags.wikiId).to.exist
      expect(flags.wikiId.required).to.be.false
      expect(flags.wikiId.description).to.include('Wiki')
      expect(flags.wikiId.description).to.include('カンマ')
    })

    it('使用例が存在すること', () => {
      const hasExample = Update.examples.some((ex) => ex.includes('--wikiId '))
      expect(hasExample).to.be.true
    })
  })

  describe('documentIdフラグ', () => {
    it('フラグが定義されており、説明にカンマ区切りの言及があること', () => {
      const {flags} = Update

      expect(flags.documentId).to.exist
      expect(flags.documentId.required).to.be.false
      expect(flags.documentId.description).to.include('ドキュメント')
      expect(flags.documentId.description).to.include('カンマ')
    })

    it('使用例が存在すること', () => {
      const hasExample = Update.examples.some((ex) => ex.includes('--documentId '))
      expect(hasExample).to.be.true
    })
  })
})
