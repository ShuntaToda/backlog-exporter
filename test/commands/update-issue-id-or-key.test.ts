import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'
import Update from '../../src/commands/update/index.js'

describe('issueIdOrKeyフラグ', () => {
  describe('Updateコマンド', () => {
    it('issueIdOrKeyフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.issueIdOrKey).to.exist
      expect(flags.issueIdOrKey.required).to.be.false
      expect(flags.issueIdOrKey.description).to.include('課題')
    })

    it('issueIdOrKeyフラグの説明にカンマ区切りについての言及があること', () => {
      const {flags} = Update

      expect(flags.issueIdOrKey.description).to.include('カンマ')
    })

    it('issueIdOrKeyの使用例が存在すること', () => {
      const {examples} = Update

      const hasIssueIdOrKeyExample = examples.some((ex) => ex.includes('--issueIdOrKey '))

      expect(hasIssueIdOrKeyExample).to.be.true
    })
  })

  describe('Issueコマンド', () => {
    it('issueIdOrKeyフラグを持たないこと（issueIdOrKeyはupdate専用）', () => {
      const flags = Issue.flags as Record<string, unknown>

      expect(flags.issueIdOrKey).to.be.undefined
    })
  })
})
