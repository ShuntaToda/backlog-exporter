import {describe, expect, it} from 'vitest'

import {buildDocumentMarkdown} from './document-markdown.js'
import {DocumentDetail} from './document.js'

const detail = (overrides: Partial<DocumentDetail> = {}): DocumentDetail => ({
  attachments: [],
  created: '2026-01-01T00:00:00Z',
  createdUser: {id: 1, name: '作成者'},
  id: 'docA',
  json: {content: [], type: 'doc'},
  plain: '',
  statusId: 1,
  tags: [],
  title: 'ドキュメントA',
  updated: '2026-01-02T00:00:00Z',
  updatedUser: {id: 2, name: '更新者'},
  ...overrides,
})

const url = 'https://example.backlog.com/document/TEST/docA'

describe('buildDocumentMarkdown（本文の生成元）', () => {
  it('jsonから本文を生成すること', () => {
    const json = {
      content: [
        {attrs: {level: 2}, content: [{text: '見出し', type: 'text'}], type: 'heading'},
        {content: [{text: '本文1', type: 'text'}], type: 'paragraph'},
        {content: [{text: '本文2', type: 'text'}], type: 'paragraph'},
      ],
      type: 'doc',
    }
    // plainは改行が失われた状態でも、jsonから改行付きで復元されること
    const markdown = buildDocumentMarkdown(detail({json, plain: '見出し本文1本文2'}), url)
    expect(markdown).to.include('## 見出し\n\n本文1\n\n本文2')
    expect(markdown).to.not.include('見出し本文1本文2')
  })

  it('jsonが空のときはplainにフォールバックすること', () => {
    const markdown = buildDocumentMarkdown(detail({plain: 'プレーン本文'}), url)
    expect(markdown).to.include('プレーン本文')
  })

  it('jsonが文字列などオブジェクトでないときもplainにフォールバックすること', () => {
    const markdown = buildDocumentMarkdown(detail({json: '{}', plain: 'プレーン本文'}), url)
    expect(markdown).to.include('プレーン本文')
  })

  it('jsonもplainも空のときは（内容なし）を出すこと', () => {
    expect(buildDocumentMarkdown(detail(), url)).to.include('（内容なし）')
  })
})
