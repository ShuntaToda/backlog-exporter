import {describe, expect, it} from 'vitest'

import {sanitizeAttachmentFileName, sanitizeFileName, sanitizeWikiFileName} from './file-name.js'

describe('file-naming - ファイル名のサニタイズ', () => {
  describe('sanitizeFileName', () => {
    it('Windows無効文字を置換すること', () => {
      const input = String.raw`file\name:with*invalid?"chars<>|`
      const result = sanitizeFileName(input)

      expect(result).to.equal('file_name_with_invalid__chars___')
      expect(result).to.not.match(/[\\/:*?"<>|]/)
    })

    it('スペースをアンダースコアに置換すること', () => {
      const input = 'file name with spaces'
      const result = sanitizeFileName(input)

      expect(result).to.equal('file_name_with_spaces')
    })

    it('ドットをアンダースコアに置換すること', () => {
      const input = 'file.name.with.dots'
      const result = sanitizeFileName(input)

      expect(result).to.equal('file_name_with_dots')
    })

    it('200文字を超える名前を切り詰めること', () => {
      const longName = 'a'.repeat(250)
      const result = sanitizeFileName(longName)

      expect(result).to.have.length(200)
      expect(result).to.equal('a'.repeat(200))
    })

    it('空文字列を適切に処理すること', () => {
      const result = sanitizeFileName('')

      expect(result).to.equal('')
    })

    it('日本語文字を正しく処理すること', () => {
      const input = 'テスト ファイル.txt'
      const result = sanitizeFileName(input)

      expect(result).to.equal('テスト_ファイル_txt')
    })
  })

  describe('sanitizeAttachmentFileName', () => {
    it('拡張子のドットを保持すること', () => {
      expect(sanitizeAttachmentFileName('image.png')).to.equal('image.png')
    })

    it('無効文字とスペースを置換しつつ拡張子を保持すること', () => {
      expect(sanitizeAttachmentFileName('設計 資料:最終版.xlsx')).to.equal('設計_資料_最終版.xlsx')
    })

    it('200文字を超える場合は拡張子を保持したまま切り詰めること', () => {
      const result = sanitizeAttachmentFileName(`${'a'.repeat(250)}.png`)

      expect(result).to.have.length(200)
      expect(result.endsWith('.png')).to.be.true
    })

    it('拡張子のない長い名前は単純に切り詰めること', () => {
      expect(sanitizeAttachmentFileName('a'.repeat(250))).to.equal('a'.repeat(200))
    })

    it('拡張子自体が200文字以上の場合も200文字に収めること', () => {
      expect(sanitizeAttachmentFileName(`a.${'b'.repeat(300)}`)).to.have.length(200)
    })
  })

  describe('sanitizeWikiFileName', () => {
    it('無効文字を置換すること（スラッシュ以外）', () => {
      const input = String.raw`wiki\name:with*invalid?"chars<>|`
      const result = sanitizeWikiFileName(input)

      expect(result).to.equal('wiki_name_with_invalid__chars___')
    })

    it('スラッシュを保持すること', () => {
      const input = 'category/subcategory/wiki-name'
      const result = sanitizeWikiFileName(input)

      expect(result).to.equal('category/subcategory/wiki-name')
      expect(result).to.include('/')
    })

    it('スラッシュ以外の無効文字のみを置換すること', () => {
      const input = 'category/wiki:name*with?invalid"chars'
      const result = sanitizeWikiFileName(input)

      expect(result).to.equal('category/wiki_name_with_invalid_chars')
    })

    it('空文字列を適切に処理すること', () => {
      const result = sanitizeWikiFileName('')

      expect(result).to.equal('')
    })

    it('日本語文字とスラッシュを正しく処理すること', () => {
      const input = 'カテゴリ/サブカテゴリ/Wiki名:テスト'
      const result = sanitizeWikiFileName(input)

      expect(result).to.equal('カテゴリ/サブカテゴリ/Wiki名_テスト')
    })
  })
})
