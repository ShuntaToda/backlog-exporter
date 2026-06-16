import {expect} from 'chai'
import {describe, it} from 'mocha'

import Document from '../../src/commands/document/index.js'
import Update from '../../src/commands/update/index.js'

describe('pruneフラグ', () => {
  describe('Updateコマンド', () => {
    it('pruneフラグが定義されていること', () => {
      const {flags} = Update

      expect(flags.prune).to.exist
      expect(flags.prune.required).to.be.false
      expect(flags.prune.description).to.include('Backlog上に存在しない')
      expect(flags.prune.description).to.include('削除')
    })
  })

  describe('Documentコマンド', () => {
    it('pruneフラグを持たないこと（pruneはupdate専用）', () => {
      const flags = Document.flags as Record<string, unknown>

      expect(flags.prune).to.be.undefined
    })
  })
})
