import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'

describe('issueIdOrKeyフラグ', () => {
  describe('Issueコマンド', () => {
    it('issueIdOrKeyフラグが定義されていること', () => {
      const {flags} = Issue

      expect(flags.issueIdOrKey).to.exist
      expect(flags.issueIdOrKey.required).to.be.false
      expect(flags.issueIdOrKey.description).to.include('課題')
    })

    it('issueIdOrKeyフラグの説明にカンマ区切りについての言及があること', () => {
      const {flags} = Issue

      expect(flags.issueIdOrKey.description).to.include('カンマ')
    })

    it('issueIdOrKeyの使用例が存在すること', () => {
      const {examples} = Issue

      const hasIssueIdOrKeyExample = examples.some((ex) => ex.includes('--issueIdOrKey '))

      expect(hasIssueIdOrKeyExample).to.be.true
    })
  })
})
