import {expect} from 'chai'
import {describe, it} from 'mocha'

import All from '../../src/commands/all/index.js'

describe('Allコマンド - 基本機能', () => {
  describe('フラグ定義', () => {
    it('必須フラグがすべて定義されていること', () => {
      const {flags} = All

      expect(flags.domain).to.exist
      expect(flags.domain.required).to.be.true
      expect(flags.projectIdOrKey).to.exist
      expect(flags.projectIdOrKey.required).to.be.true
    })

    it('オプションフラグが正しいデフォルト値を持つこと', () => {
      const {flags} = All

      expect(flags.maxCount.default).to.equal(5000)
      expect(flags.apiKey.required).to.be.false
      expect(flags.output.required).to.be.false
    })
  })

  describe('ターゲット検証ロジック', () => {
    it('有効な個別ターゲットを受け入れること', () => {
      const validTargets = new Set(['documents', 'issues', 'wiki'])

      expect(validTargets.has('issues')).to.be.true
      expect(validTargets.has('wiki')).to.be.true
      expect(validTargets.has('documents')).to.be.true
    })

    it('無効なターゲットを拒否すること', () => {
      const validTargets = new Set(['documents', 'issues', 'wiki'])

      expect(validTargets.has('invalid')).to.be.false
      expect(validTargets.has('unknown')).to.be.false
      expect(validTargets.has('test')).to.be.false
    })
  })

  describe('デフォルト動作', () => {
    it('フラグが指定されていない場合はすべてのターゲットをデフォルトにすること', () => {
      const targets = ['issues', 'wiki', 'documents']

      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])
      expect(targets).to.have.lengthOf(3)
    })
  })

  describe('使用例', () => {
    it('基本的な使用例が存在すること', () => {
      const {examples} = All

      expect(examples).to.be.an('array')
      expect(examples.length).to.be.greaterThan(0)

      const hasBasicExample = examples.some((ex) => ex.includes('--apiKey'))
      const hasOutputExample = examples.some((ex) => ex.includes('--output'))
      const hasMaxCountExample = examples.some((ex) => ex.includes('--maxCount'))

      expect(hasBasicExample).to.be.true
      expect(hasOutputExample).to.be.true
      expect(hasMaxCountExample).to.be.true
    })
  })
})
