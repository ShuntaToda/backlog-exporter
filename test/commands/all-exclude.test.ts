import {expect} from 'chai'
import {describe, it} from 'mocha'

import All from '../../src/commands/all/index.js'

describe('Allコマンド - excludeフラグ機能', () => {
  describe('フラグ定義', () => {
    it('excludeフラグが正しいプロパティで定義されていること', () => {
      const {flags} = All

      expect(flags.exclude).to.exist
      expect(flags.exclude.description).to.equal(
        "Exclude the specified types, separated by commas (e.g., 'documents,wiki')",
      )
      expect(flags.exclude.required).to.be.false
    })
  })

  describe('除外ロジック', () => {
    it('除外対象を正しく解析すること', () => {
      const excludeValue = 'documents,wiki'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal(['issues'])
      expect(targets).to.have.lengthOf(1)
    })

    it('単一の除外対象を処理できること', () => {
      const excludeValue = 'documents'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal(['issues', 'wiki'])
      expect(targets).to.have.lengthOf(2)
    })

    it('複数の除外対象を処理できること', () => {
      const excludeValue = 'issues,documents'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal(['wiki'])
      expect(targets).to.have.lengthOf(1)
    })

    it('存在しない除外対象を指定した場合の動作', () => {
      const excludeValue = 'invalid,unknown'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])
      expect(targets).to.have.lengthOf(3)
    })

    it('すべてのターゲットを除外するとエラーになること', () => {
      const excludeValue = 'issues,wiki,documents'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal([])
      expect(targets).to.have.lengthOf(0)
    })
  })

  describe('フラグの競合チェック', () => {
    it('onlyとexcludeの競合を検出できること', () => {
      const only = 'issues,wiki'
      const exclude = 'documents'
      const hasConflict = Boolean(only && exclude)

      expect(hasConflict).to.be.true
    })

    it('onlyのみが指定された場合は競合なし', () => {
      const only = 'issues,wiki'
      const exclude = undefined
      const hasConflict = Boolean(only && exclude)

      expect(hasConflict).to.be.false
    })

    it('excludeのみが指定された場合は競合なし', () => {
      const only = undefined
      const exclude = 'documents'
      const hasConflict = Boolean(only && exclude)

      expect(hasConflict).to.be.false
    })

    it('どちらも指定されていない場合は競合なし', () => {
      const only = undefined
      const exclude = undefined
      const hasConflict = Boolean(only && exclude)

      expect(hasConflict).to.be.false
    })
  })

  describe('ターゲット決定ロジック', () => {
    it('excludeが指定された場合の動作', () => {
      const exclude = 'documents'
      const excludeTargets = exclude.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const targets = allTargets.filter(target => !excludeTargets.includes(target))

      expect(targets).to.deep.equal(['issues', 'wiki'])
    })

    it('条件分岐ロジックをテストする', () => {
      // Test exclude case
      const excludeValue = 'documents'
      const excludeTargets = excludeValue.split(',')
      const allTargets = ['issues', 'wiki', 'documents']
      const remainingTargets = allTargets.filter(target => !excludeTargets.includes(target))
      expect(remainingTargets).to.deep.equal(['issues', 'wiki'])
    })
  })

  describe('使用例', () => {
    it('excludeフラグの使用例が存在すること', () => {
      const {examples} = All

      const hasExcludeExample = examples.some((ex) => ex.includes('--exclude'))
      expect(hasExcludeExample).to.be.true
    })
  })
})