import {describe, expect, it} from 'vitest'

import {findDocumentsMissingFromTree} from './document-tree-gap.js'
import {DocumentNode, DocumentTree} from './document.js'

const node = (id: string, name: string, children: DocumentNode[] = []): DocumentNode => ({children, id, name})

const tree = (children: DocumentNode[], trashChildren: DocumentNode[] = []): DocumentTree => ({
  activeTree: {children, id: 'root'},
  trashTree: {children: trashChildren, id: 'trash'},
})

describe('findDocumentsMissingFromTree（ツリーに現れないドキュメントの抽出）', () => {
  it('一覧にはあるがツリーに無いドキュメントを返すこと', () => {
    const missing = findDocumentsMissingFromTree(
      tree([node('d1', 'ドキュメント1')]),
      new Map([
        ['d1', 'ドキュメント1'],
        ['d2', '未保存のドキュメント'],
      ]),
    )

    expect(missing).to.deep.equal([{id: 'd2', title: '未保存のドキュメント'}])
  })

  it('入れ子のフォルダ配下にあるドキュメントはツリー内として扱うこと', () => {
    const missing = findDocumentsMissingFromTree(
      tree([node('parent', '親', [node('child', '子', [node('grandchild', '孫')])])]),
      new Map([
        ['child', '子'],
        ['grandchild', '孫'],
        ['parent', '親'],
      ]),
    )

    expect(missing).to.deep.equal([])
  })

  it('ゴミ箱のツリーにあるドキュメントは対象外にすること', () => {
    const missing = findDocumentsMissingFromTree(
      tree([node('d1', 'ドキュメント1')], [node('trashed', '削除済み')]),
      new Map([
        ['d1', 'ドキュメント1'],
        ['trashed', '削除済み'],
      ]),
    )

    expect(missing).to.deep.equal([])
  })

  it('trashTreeを含まないレスポンスでもクラッシュしないこと', () => {
    const missing = findDocumentsMissingFromTree({activeTree: {children: [], id: 'root'}}, new Map([['d1', 'docA']]))

    expect(missing).to.deep.equal([{id: 'd1', title: 'docA'}])
  })

  it('一覧が空なら何も返さないこと', () => {
    expect(findDocumentsMissingFromTree(tree([node('d1', 'ドキュメント1')]), new Map())).to.deep.equal([])
  })
})
