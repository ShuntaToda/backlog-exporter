import {describe, expect, it} from 'vitest'

import {planDocumentSave} from './document-save-plan.js'

const base = {
  asParentIndex: false,
  body: '本文',
  parentIndexAlreadyWrittenThisRun: false,
  parentIndexExists: false,
  updated: '2026-01-02T00:00:00Z',
}

describe('planDocumentSave（ドキュメント保存の判断）', () => {
  it('通常のドキュメントは保存すること', () => {
    expect(planDocumentSave(base)).to.equal('save')
  })

  it('前回更新以降に変更がないドキュメントはスキップすること', () => {
    expect(planDocumentSave({...base, lastUpdated: '2026-06-01T00:00:00Z'})).to.equal('skip-unchanged')
  })

  it('前回更新以降に変更があるドキュメントは保存すること', () => {
    expect(planDocumentSave({...base, lastUpdated: '2025-12-01T00:00:00Z'})).to.equal('save')
  })

  describe('親ドキュメント本文（親index）', () => {
    const parent = {...base, asParentIndex: true}

    it('本文を持つ親は保存すること', () => {
      expect(planDocumentSave(parent)).to.equal('save')
    })

    it('本文が空の親はファイルを作成しないこと', () => {
      expect(planDocumentSave({...parent, body: '   '})).to.equal('skip-empty-parent')
    })

    it('本文がnullの親も空として扱うこと', () => {
      expect(planDocumentSave({...parent, body: null})).to.equal('skip-empty-parent')
    })

    it('本文が空に変更された親は、残っている古い親indexを削除すること', () => {
      expect(planDocumentSave({...parent, body: '', parentIndexExists: true})).to.equal('delete-stale-parent-index')
    })

    it('未更新でも親indexが未作成ならバックフィルとして保存すること', () => {
      expect(planDocumentSave({...parent, lastUpdated: '2026-06-01T00:00:00Z'})).to.equal('save')
    })

    it('未更新で親indexが作成済みならスキップすること', () => {
      expect(planDocumentSave({...parent, lastUpdated: '2026-06-01T00:00:00Z', parentIndexExists: true})).to.equal(
        'skip-unchanged',
      )
    })

    it('子ドキュメントが同名ファイルを書き込み済みなら上書きせずスキップすること', () => {
      expect(planDocumentSave({...parent, parentIndexAlreadyWrittenThisRun: true})).to.equal(
        'skip-parent-index-collision',
      )
    })
  })
})
