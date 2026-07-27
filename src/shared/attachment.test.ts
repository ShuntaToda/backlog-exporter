import {describe, expect, it} from 'vitest'

import {attachmentFileName, encodeLinkDestination, rewriteInlineImages} from './attachment.js'

describe('attachment - 添付ファイル共通処理', () => {
  describe('attachmentFileName', () => {
    it('添付IDを前置しサニタイズした名前を返すこと', () => {
      expect(attachmentFileName({id: 10, name: '設計 資料.png'})).to.equal('10_設計_資料.png')
    })
  })

  describe('encodeLinkDestination', () => {
    it('丸括弧をパーセントエンコードすること', () => {
      expect(encodeLinkDestination('./attachments/10_image_(3).png')).to.equal('./attachments/10_image_%283%29.png')
    })
  })

  describe('rewriteInlineImages', () => {
    const attachments = [
      {id: 10, name: 'design.png'},
      {id: 11, name: 'スクリーンショット 2026-06-18 12.37.25.png'},
    ]
    const links = new Map([
      [10, './attachments/TEST-1/10_design.png'],
      [11, './attachments/TEST-1/11_スクリーンショット_2026-06-18_12.37.25.png'],
    ])

    it('Markdown拡張記法 ![image][ファイル名] をローカルリンクに変換すること', () => {
      const result = rewriteInlineImages('前文\n![image][design.png]\n後文', attachments, links)
      expect(result).to.equal('前文\n![design.png](./attachments/TEST-1/10_design.png)\n後文')
    })

    it('スペース入り日本語ファイル名も変換すること', () => {
      const result = rewriteInlineImages('![image][スクリーンショット 2026-06-18 12.37.25.png]', attachments, links)
      expect(result).to.equal(
        '![スクリーンショット 2026-06-18 12.37.25.png](./attachments/TEST-1/11_スクリーンショット_2026-06-18_12.37.25.png)',
      )
    })

    it('Backlog記法 #image(ファイル名) をローカルリンクに変換すること', () => {
      const result = rewriteInlineImages('#image(design.png)', attachments, links)
      expect(result).to.equal('![design.png](./attachments/TEST-1/10_design.png)')
    })

    it('添付一覧にないファイル名の参照はそのまま残すこと', () => {
      const text = '![image][unknown.png] と #image(other.png)'
      expect(rewriteInlineImages(text, attachments, links)).to.equal(text)
    })

    it('ダウンロードされていない添付への参照はそのまま残すこと', () => {
      const text = '![image][design.png]'
      expect(rewriteInlineImages(text, attachments, new Map())).to.equal(text)
      expect(rewriteInlineImages(text, attachments)).to.equal(text)
    })

    it('NFD（結合濁点）の参照名をNFCの添付名と照合できること', () => {
      const nfdName = 'ドリンク.png'.normalize('NFD')
      const result = rewriteInlineImages(
        `![image][${nfdName}]`,
        [{id: 20, name: 'ドリンク.png'.normalize('NFC')}],
        new Map([[20, './attachments/TEST-1/20_ドリンク.png']]),
      )
      expect(result).to.equal(`![${nfdName}](./attachments/TEST-1/20_ドリンク.png)`)
    })

    it('ファイル名中の角括弧をエスケープすること', () => {
      const result = rewriteInlineImages(
        '#image(x]y.png)',
        [{id: 30, name: 'x]y.png'}],
        new Map([[30, './attachments/TEST-1/30_x_y.png']]),
      )
      expect(result).to.equal(String.raw`![x\]y.png](./attachments/TEST-1/30_x_y.png)`)
    })

    it('通常の参照リンク（添付名と一致しないラベル）を壊さないこと', () => {
      const text = '![alt text][ref1]\n\n[ref1]: https://example.com/a.png'
      expect(rewriteInlineImages(text, attachments, links)).to.equal(text)
    })

    it('1テキスト内の複数の記法をすべて変換すること', () => {
      const result = rewriteInlineImages('![image][design.png] と #image(design.png)', attachments, links)
      expect(result).to.equal(
        '![design.png](./attachments/TEST-1/10_design.png) と ![design.png](./attachments/TEST-1/10_design.png)',
      )
    })
  })
})
