import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'

describe('issueKeyフラグ', () => {
  describe('Issueコマンド', () => {
    it('issueKeyフラグが定義されていること', () => {
      const {flags} = Issue

      expect(flags.issueKey).to.exist
      expect(flags.issueKey.required).to.be.false
      expect(flags.issueKey.description).to.include('課題キー')
    })

    it('issueKeyフラグの説明にカンマ区切りについての言及があること', () => {
      const {flags} = Issue

      expect(flags.issueKey.description).to.include('カンマ')
    })

    it('issueKeyの使用例が存在すること', () => {
      const {examples} = Issue

      const hasIssueKeyExample = examples.some((ex) => ex.includes('--issueKey '))

      expect(hasIssueKeyExample).to.be.true
    })
  })
})
