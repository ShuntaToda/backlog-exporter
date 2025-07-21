import {expect} from 'chai'

import {createCustomFieldsSection} from '../../src/utils/backlog-api.js'

describe('backlog-api utility functions', () => {
  describe('createCustomFieldsSection', () => {
    it('空の配列の場合は空文字列を返すこと', () => {
      const result = createCustomFieldsSection([])
      expect(result).to.equal('')
    })

    it('undefinedの場合は空文字列を返すこと', () => {
      const result = createCustomFieldsSection()
      expect(result).to.equal('')
    })

    it('単一のプリミティブ値を持つカスタム属性が正しく表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '工数（エンジニア）',
          value: 5,
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 工数（エンジニア） | 5 |\n'

      expect(result).to.equal(expected)
    })

    it('null値を持つカスタム属性が「なし」として表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '工数（PPO）',
          value: null,
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 工数（PPO） | なし |\n'

      expect(result).to.equal(expected)
    })

    it('undefined値を持つカスタム属性が「なし」として表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '工数（PPO）',
          value: undefined,
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 工数（PPO） | なし |\n'

      expect(result).to.equal(expected)
    })

    it('配列値を持つカスタム属性が正しくカンマ区切りで表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '担当チーム',
          value: [{name: 'フロントエンド'}, {name: 'バックエンド'}, {name: 'インフラ'}],
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected =
        '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 担当チーム | フロントエンド, バックエンド, インフラ |\n'

      expect(result).to.equal(expected)
    })

    it('オブジェクト値を持つカスタム属性が正しく表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '優先度',
          value: {name: '高'},
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 優先度 | 高 |\n'

      expect(result).to.equal(expected)
    })

    it('改行を含む長いテキストが<br>タグに変換されること', () => {
      const customFields = [
        {
          id: 1,
          name: '工数詳細',
          value: '段階的リリース\n6/25 STGリリース\n7/9 本番リリース',
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected =
        '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 工数詳細 | 段階的リリース<br>6/25 STGリリース<br>7/9 本番リリース |\n'

      expect(result).to.equal(expected)
    })

    it('パイプ文字がエスケープされること', () => {
      const customFields = [
        {
          id: 1,
          name: 'テストケース',
          value: 'test1 | test2 | test3',
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected =
        '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| テストケース | test1 \\| test2 \\| test3 |\n'

      expect(result).to.equal(expected)
    })

    it('複数のカスタム属性が正しく表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '工数（エンジニア）',
          value: 3,
        },
        {
          id: 2,
          name: '工数（PPO）',
          value: null,
        },
        {
          id: 3,
          name: '担当チーム',
          value: [{name: 'フロントエンド'}, {name: 'バックエンド'}],
        },
        {
          id: 4,
          name: '詳細',
          value: '実装内容\n- 機能A\n- 機能B',
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected =
        '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 工数（エンジニア） | 3 |\n| 工数（PPO） | なし |\n| 担当チーム | フロントエンド, バックエンド |\n| 詳細 | 実装内容<br>- 機能A<br>- 機能B |\n'

      expect(result).to.equal(expected)
    })

    it('valueプロパティを持つオブジェクトが正しく表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: 'ステータス',
          value: {value: '進行中'},
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| ステータス | 進行中 |\n'

      expect(result).to.equal(expected)
    })

    it('配列内のオブジェクトがvalueプロパティを持つ場合に正しく表示されること', () => {
      const customFields = [
        {
          id: 1,
          name: '選択肢',
          value: [{value: '選択肢1'}, {value: '選択肢2'}],
        },
      ]

      const result = createCustomFieldsSection(customFields)
      const expected = '\n\n## カスタム属性\n\n| 属性名 | 値 |\n|--------|----|\n| 選択肢 | 選択肢1, 選択肢2 |\n'

      expect(result).to.equal(expected)
    })
  })
})
