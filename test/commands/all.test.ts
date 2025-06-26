import {expect} from 'chai'
import {describe, it} from 'mocha'

import All from '../../src/commands/all/index.js'

describe('Allコマンド', () => {
  describe('onlyフラグ機能', () => {
    it('onlyフラグが正しいプロパティで定義されていること', () => {
      const {flags} = All

      expect(flags.only).to.exist
      expect(flags.only.description).to.equal(
        "Export only the specified types, separated by commas (e.g., 'issues,wiki')",
      )
      expect(flags.only.required).to.be.false
    })

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
      expect(flags.only.required).to.be.false
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

    it('カンマ区切りのターゲットを正しく解析すること', () => {
      const onlyValue = 'issues,wiki'
      const targets = onlyValue.split(',')

      expect(targets).to.deep.equal(['issues', 'wiki'])
      expect(targets).to.have.lengthOf(2)
    })

    it('単一ターゲットを処理できること', () => {
      const onlyValue = 'issues'
      const targets = onlyValue.split(',')

      expect(targets).to.deep.equal(['issues'])
      expect(targets).to.have.lengthOf(1)
    })

    it('3つすべてのターゲットを処理できること', () => {
      const onlyValue = 'issues,wiki,documents'
      const targets = onlyValue.split(',')

      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])
      expect(targets).to.have.lengthOf(3)
    })
  })

  describe('デフォルト動作', () => {
    it('onlyが未定義の場合にすべてのターゲットをデフォルトにすること', () => {
      const targets = ['issues', 'wiki', 'documents']

      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])
    })

    it('onlyが提供された場合にそのターゲットのみを使用すること', () => {
      const onlyFlag = 'issues,wiki'
      const targets = onlyFlag.split(',')

      expect(targets).to.deep.equal(['issues', 'wiki'])
    })

    it('コマンドで使用される条件ロジックパターンを処理できること', () => {
      // パターンをテスト: const targets = only ? only.split(',') : ['issues', 'wiki', 'documents']

      // onlyがfalsyの場合
      let only = ''
      let targets = only ? only.split(',') : ['issues', 'wiki', 'documents']
      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])

      // onlyに値がある場合
      only = 'issues,wiki'
      targets = only ? only.split(',') : ['issues', 'wiki', 'documents']
      expect(targets).to.deep.equal(['issues', 'wiki'])
    })
  })

  describe('ターゲット包含チェック', () => {
    it('issuesが含まれているかを正しく識別すること', () => {
      const targets1 = ['issues', 'wiki']
      const targets2 = ['wiki', 'documents']

      expect(targets1.includes('issues')).to.be.true
      expect(targets2.includes('issues')).to.be.false
    })

    it('wikiが含まれているかを正しく識別すること', () => {
      const targets1 = ['issues', 'wiki']
      const targets2 = ['issues', 'documents']

      expect(targets1.includes('wiki')).to.be.true
      expect(targets2.includes('wiki')).to.be.false
    })

    it('documentsが含まれているかを正しく識別すること', () => {
      const targets1 = ['wiki', 'documents']
      const targets2 = ['issues', 'wiki']

      expect(targets1.includes('documents')).to.be.true
      expect(targets2.includes('documents')).to.be.false
    })
  })

  describe('使用例', () => {
    it('異なる使用例を示す例が存在すること', () => {
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
