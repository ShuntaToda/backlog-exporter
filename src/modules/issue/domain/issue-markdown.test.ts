import {describe, expect, it} from 'vitest'

import {buildCommentsSection, createCustomFieldsSection} from './issue-markdown.js'

describe('issue-markdown', () => {
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

  describe('buildCommentsSection（変更履歴の記載）', () => {
    const baseComment = {
      created: '2026-01-02T10:00:00Z',
      createdUser: {id: 1, name: '山田'},
      id: 100,
    }
    const url = 'https://example.backlog.jp/view/TEST-1'

    it('本文なし・変更履歴ありのコメントは変更内容を記載すること', () => {
      const section = buildCommentsSection(
        [
          {
            ...baseComment,
            changeLog: [
              {field: 'status', newValue: '処理中', originalValue: '未対応'},
              {field: 'assigner', newValue: '山田', originalValue: null},
            ],
            content: null,
          },
        ],
        url,
      )

      expect(section).to.include('**変更内容**')
      expect(section).to.include('- 状態: 未対応 → 処理中')
      expect(section).to.include('- 担当者: 未設定 → 山田')
      expect(section).to.not.include('(内容なし)')
    })

    it('本文と変更履歴が両方ある場合は本文の後に変更内容を記載すること', () => {
      const section = buildCommentsSection(
        [
          {
            ...baseComment,
            changeLog: [{field: 'limitDate', newValue: '2026-07-31', originalValue: null}],
            content: '対応します',
          },
        ],
        url,
      )

      expect(section).to.include('対応します\n\n**変更内容**\n- 期限日: 未設定 → 2026-07-31')
    })

    it('未知のfieldはそのままのキー名で記載すること', () => {
      const section = buildCommentsSection(
        [{...baseComment, changeLog: [{field: 'customField_123', newValue: 'B', originalValue: 'A'}], content: null}],
        url,
      )

      expect(section).to.include('- customField_123: A → B')
    })

    it('カスタム属性の変更はfieldに入る属性名がそのまま記載されること', () => {
      const section = buildCommentsSection(
        [
          {
            ...baseComment,
            changeLog: [{field: '工数（エンジニア）', newValue: '0.375 人日', originalValue: '0.5 人日'}],
            content: null,
          },
        ],
        url,
      )

      expect(section).to.include('- 工数（エンジニア）: 0.5 人日 → 0.375 人日')
    })

    it('複数行・長文の変更値は1行化して切り詰めること', () => {
      const longValue = '1行目の説明テキスト\n2行目の説明テキスト\n' + 'あ'.repeat(60)
      const section = buildCommentsSection(
        [{...baseComment, changeLog: [{field: 'description', newValue: null, originalValue: longValue}], content: null}],
        url,
      )

      expect(section).to.include('- 詳細: 1行目の説明テキスト 2行目の説明テキスト')
      expect(section).to.include('… → 未設定')
      expect(section, '改行がリストを崩さないこと').to.not.include('2行目の説明テキスト\n')
    })

    it('本文も変更履歴もない場合は従来どおり(内容なし)と記載すること', () => {
      const section = buildCommentsSection([{...baseComment, content: ''}], url)

      expect(section).to.include('(内容なし)')
    })
  })
})
