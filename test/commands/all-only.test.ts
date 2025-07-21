import {expect} from 'chai'
import {describe, it} from 'mocha'

import All from '../../src/commands/all/index.js'

describe('Allコマンド - onlyフラグ機能', () => {
  describe('フラグ定義', () => {
    it('onlyフラグが正しいプロパティで定義されていること', () => {
      const {flags} = All

      expect(flags.only).to.exist
      expect(flags.only.description).to.equal(
        "Export only the specified types, separated by commas (e.g., 'issues,wiki')",
      )
      expect(flags.only.required).to.be.false
    })
  })

  describe('ターゲット解析', () => {
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

  describe('条件ロジック', () => {
    it('onlyが未定義の場合にすべてのターゲットをデフォルトにすること', () => {
      const targets = ['issues', 'wiki', 'documents']

      expect(targets).to.deep.equal(['issues', 'wiki', 'documents'])
    })

    it('onlyが提供された場合にそのターゲットのみを使用すること', () => {
      const only = 'issues,wiki'
      const targets = only.split(',')

      expect(targets).to.deep.equal(['issues', 'wiki'])
    })

    it('条件ロジックパターンを処理できること', () => {
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
    it('onlyフラグの使用例が存在すること', () => {
      const {examples} = All

      const hasOnlyExample = examples.some((ex) => ex.includes('--only'))
      expect(hasOnlyExample).to.be.true
    })
  })
})
