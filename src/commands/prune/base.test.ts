import {describe, expect, it} from 'vitest'

import Update from '../update/index.js'
import Prune from './index.js'

describe('pruneコマンド', () => {
  it('コマンドが定義されており、説明に削除の旨が含まれること', () => {
    expect(Prune.description).to.include('削除')
  })

  it('forceフラグが定義されていること', () => {
    const {flags} = Prune
    expect(flags.force).to.exist
    expect(flags.force.required).to.be.false
  })

  it('domain / projectIdOrKey は任意（設定ファイルからフォールバックするため）であること', () => {
    const {flags} = Prune
    expect(flags.domain.required).to.be.false
    expect(flags.projectIdOrKey.required).to.be.false
  })

  it('updateコマンドには--pruneフラグが存在しないこと（pruneは独立コマンド）', () => {
    const flags = Update.flags as Record<string, unknown>
    expect(flags.prune).to.be.undefined
  })
})
