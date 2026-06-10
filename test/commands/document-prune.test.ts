import {expect} from 'chai'
import {describe, it} from 'mocha'

import Document from '../../src/commands/document/index.js'
import Update from '../../src/commands/update/index.js'

describe('pruneフラグ', () => {
  describe('Documentコマンド', () => {
    it('pruneフラグが定義されていること', () => {
      const {flags} = Document

      expect(flags.prune).to.exist
      expect(flags.prune.required).to.be.false
      expect(flags.prune.description).to.include('Backlog上に存在しない')
      expect(flags.prune.description).to.include('削除')
    })

    it('pruneの使用例が存在すること', () => {
      const {examples} = Document

      const hasPruneExample = examples.some((ex) => ex.includes('--prune'))

      expect(hasPruneExample).to.be.true
    })
  })

  describe('Updateコマンド', () => {
    it('pruneフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.prune).to.exist
      expect(flags.prune.required).to.be.false
      expect(flags.prune.description).to.include('Backlog上に存在しない')
      expect(flags.prune.description).to.include('削除')
    })
  })
})
