import {expect} from 'chai'
import {describe, it} from 'mocha'

import {sanitizeFileName, sanitizeWikiFileName} from '../../src/utils/common.js'

describe('common.ts - ユーティリティ関数', () => {
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
