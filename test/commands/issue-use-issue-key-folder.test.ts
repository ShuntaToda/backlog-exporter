import {expect} from 'chai'
import {describe, it} from 'mocha'

import All from '../../src/commands/all/index.js'
import Issue from '../../src/commands/issue/index.js'
import Update from '../../src/commands/update/index.js'

describe('issueKeyFileName/issueKeyFolderフラグ', () => {
  describe('Issueコマンド', () => {
    it('issueKeyFileNameフラグが定義されていること', () => {
      const {flags} = Issue

      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFileName.description).to.include('ファイル名を課題キー')
    })

    it('issueKeyFolderフラグが定義されていること', () => {
      const {flags} = Issue

      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
      expect(flags.issueKeyFolder.description).to.include('課題キーでフォルダ')
    })

    it('issueKeyFileNameの使用例が存在すること', () => {
      const {examples} = Issue

      const hasIssueKeyFileNameExample = examples.some((ex) => ex.includes('--issueKeyFileName'))

      expect(hasIssueKeyFileNameExample).to.be.true
    })

    it('issueKeyFolderの使用例が存在すること', () => {
      const {examples} = Issue

      const hasIssueKeyFolderExample = examples.some((ex) => ex.includes('--issueKeyFolder'))

      expect(hasIssueKeyFolderExample).to.be.true
    })
  })

  describe('Allコマンド', () => {
    it('issueKeyFileNameフラグが定義されていること', () => {
      const {flags} = All

      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFileName.description).to.include('ファイル名を課題キー')
    })

    it('issueKeyFolderフラグが定義されていること', () => {
      const {flags} = All

      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
      expect(flags.issueKeyFolder.description).to.include('課題キーでフォルダ')
    })

    it('issueKeyFileNameの使用例が存在すること', () => {
      const {examples} = All

      const hasIssueKeyFileNameExample = examples.some((ex) => ex.includes('--issueKeyFileName'))

      expect(hasIssueKeyFileNameExample).to.be.true
    })

    it('issueKeyFolderの使用例が存在すること', () => {
      const {examples} = All

      const hasIssueKeyFolderExample = examples.some((ex) => ex.includes('--issueKeyFolder'))

      expect(hasIssueKeyFolderExample).to.be.true
    })
  })

  describe('Updateコマンド', () => {
    it('issueKeyFileNameフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.issueKeyFileName).to.exist
      expect(flags.issueKeyFileName.required).to.be.false
      expect(flags.issueKeyFileName.description).to.include('ファイル名を課題キー')
    })

    it('issueKeyFolderフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.issueKeyFolder).to.exist
      expect(flags.issueKeyFolder.required).to.be.false
      expect(flags.issueKeyFolder.description).to.include('課題キーでフォルダ')
    })

    it('issueKeyFileNameの使用例が存在すること', () => {
      const {examples} = Update

      const hasIssueKeyFileNameExample = examples.some((ex) => ex.includes('--issueKeyFileName'))

      expect(hasIssueKeyFileNameExample).to.be.true
    })

    it('issueKeyFolderの使用例が存在すること', () => {
      const {examples} = Update

      const hasIssueKeyFolderExample = examples.some((ex) => ex.includes('--issueKeyFolder'))

      expect(hasIssueKeyFolderExample).to.be.true
    })
  })
})
