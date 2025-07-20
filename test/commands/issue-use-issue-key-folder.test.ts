import {expect} from 'chai'
import {describe, it} from 'mocha'

import Issue from '../../src/commands/issue/index.js'
import All from '../../src/commands/all/index.js'
import Update from '../../src/commands/update/index.js'

describe('useIssueKeyFolderフラグ', () => {
  describe('Issueコマンド', () => {
    it('useIssueKeyFolderフラグが定義されていること', () => {
      const {flags} = Issue

      expect(flags.useIssueKeyFolder).to.exist
      expect(flags.useIssueKeyFolder.required).to.be.false
      expect(flags.useIssueKeyFolder.description).to.include('課題キーでフォルダを作成')
    })

    it('useIssueKeyFolderの使用例が存在すること', () => {
      const {examples} = Issue

      const hasUseIssueKeyFolderExample = examples.some((ex) => 
        ex.includes('--useIssueKeyFolder')
      )

      expect(hasUseIssueKeyFolderExample).to.be.true
    })
  })

  describe('Allコマンド', () => {
    it('useIssueKeyFolderフラグが定義されていること', () => {
      const {flags} = All

      expect(flags.useIssueKeyFolder).to.exist
      expect(flags.useIssueKeyFolder.required).to.be.false
      expect(flags.useIssueKeyFolder.description).to.include('課題キーでフォルダを作成')
    })

    it('useIssueKeyFolderの使用例が存在すること', () => {
      const {examples} = All

      const hasUseIssueKeyFolderExample = examples.some((ex) => 
        ex.includes('--useIssueKeyFolder')
      )

      expect(hasUseIssueKeyFolderExample).to.be.true
    })
  })

  describe('Updateコマンド', () => {
    it('useIssueKeyFolderフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.useIssueKeyFolder).to.exist
      expect(flags.useIssueKeyFolder.required).to.be.false
      expect(flags.useIssueKeyFolder.description).to.include('課題キーでフォルダを作成')
    })

    it('useIssueKeyFolderの使用例が存在すること', () => {
      const {examples} = Update

      const hasUseIssueKeyFolderExample = examples.some((ex) => 
        ex.includes('--useIssueKeyFolder')
      )

      expect(hasUseIssueKeyFolderExample).to.be.true
    })
  })
}) 