import {describe, expect, it} from 'vitest'

import {applyContentSelection, parseContentSelection} from './content-selection.js'

describe('parseContentSelection', () => {
  it('「2」またはwikiはWikiのみを選択すること', () => {
    expect(parseContentSelection('2')).to.equal('wiki')
    expect(parseContentSelection('wiki')).to.equal('wiki')
    expect(parseContentSelection(' Wiki ')).to.equal('wiki')
  })

  it('「3」またはdocument(s)はドキュメントのみを選択すること', () => {
    expect(parseContentSelection('3')).to.equal('documents')
    expect(parseContentSelection('document')).to.equal('documents')
    expect(parseContentSelection('documents')).to.equal('documents')
  })

  it('空入力・「1」・不正な入力は両方を選択すること', () => {
    expect(parseContentSelection('')).to.equal('both')
    expect(parseContentSelection('1')).to.equal('both')
    expect(parseContentSelection('xyz')).to.equal('both')
  })
})

describe('applyContentSelection', () => {
  const all: Array<'documents' | 'issues' | 'wiki'> = ['issues', 'wiki', 'documents']

  it('wiki選択時はドキュメントを除外すること（課題は残る）', () => {
    expect(applyContentSelection(all, 'wiki')).to.deep.equal(['issues', 'wiki'])
  })

  it('documents選択時はWikiを除外すること（課題は残る）', () => {
    expect(applyContentSelection(all, 'documents')).to.deep.equal(['issues', 'documents'])
  })

  it('both選択時は全対象を維持すること', () => {
    expect(applyContentSelection(all, 'both')).to.deep.equal(all)
  })
})
