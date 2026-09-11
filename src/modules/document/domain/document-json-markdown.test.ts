import {describe, expect, it} from 'vitest'

import {convertDocumentJsonToMarkdown} from './document-json-markdown.js'

const doc = (...content: unknown[]) => ({content, type: 'doc'})
const text = (value: string, marks?: unknown[]) =>
  marks ? {marks, text: value, type: 'text'} : {text: value, type: 'text'}
const paragraph = (...content: unknown[]) => ({content, type: 'paragraph'})
const cell = (type: string, value: string) => ({content: [paragraph(text(value))], type})

describe('convertDocumentJsonToMarkdown（ProseMirror JSON → Markdown）', () => {
  describe('見出しと段落', () => {
    it('レベルに応じた#付きの見出しを出力すること', () => {
      const json = doc(
        {attrs: {id: 'h1', level: 1}, content: [text('タイトル')], type: 'heading'},
        {attrs: {level: 3}, content: [text('小見出し')], type: 'heading'},
      )
      expect(convertDocumentJsonToMarkdown(json)).to.equal('# タイトル\n\n### 小見出し')
    })

    it('段落の間に空行を入れること', () => {
      const json = doc(paragraph(text('1段落目')), paragraph(text('2段落目')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('1段落目\n\n2段落目')
    })

    it('hardBreakを行末2スペースの改行にすること', () => {
      const json = doc(paragraph(text('前'), {type: 'hardBreak'}, text('後')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('前  \n後')
    })

    it('空のドキュメントは空文字を返すこと', () => {
      expect(convertDocumentJsonToMarkdown(doc())).to.equal('')
      expect(convertDocumentJsonToMarkdown({content: [], type: 'doc'})).to.equal('')
    })

    it('オブジェクト以外は空文字を返すこと', () => {
      expect(convertDocumentJsonToMarkdown(null)).to.equal('')
      expect(convertDocumentJsonToMarkdown('{}')).to.equal('')
      expect(convertDocumentJsonToMarkdown([])).to.equal('')
    })
  })

  describe('マーク', () => {
    it('bold/italic/strike/codeをそれぞれの記法にすること', () => {
      const json = doc(
        paragraph(
          text('太字', [{type: 'bold'}]),
          text('斜体', [{type: 'italic'}]),
          text('打消', [{type: 'strike'}]),
          text('コード', [{type: 'code'}]),
        ),
      )
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**太字***斜体*~~打消~~`コード`')
    })

    it('linkをMarkdownリンクにすること', () => {
      const json = doc(paragraph(text('例', [{attrs: {href: 'https://example.com'}, type: 'link'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('[例](https://example.com)')
    })

    it('codeを最内側にしてマークを組み合わせること', () => {
      const json = doc(paragraph(text('値', [{type: 'bold'}, {type: 'code'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**`値`**')
    })

    it('boldとlinkを組み合わせるとリンクが外側になること', () => {
      const json = doc(paragraph(text('例', [{attrs: {href: 'https://example.com'}, type: 'link'}, {type: 'bold'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('[**例**](https://example.com)')
    })

    it('textStyleなど未知のマークは無視すること', () => {
      const json = doc(paragraph(text('色付き', [{attrs: {color: '#ff0000'}, type: 'textStyle'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('色付き')
    })
  })

  describe('リスト', () => {
    it('bulletListを-にすること', () => {
      const json = doc({
        content: [
          {content: [paragraph(text('一つ目'))], type: 'listItem'},
          {content: [paragraph(text('二つ目'))], type: 'listItem'},
        ],
        type: 'bulletList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- 一つ目\n- 二つ目')
    })

    it('orderedListを連番にすること', () => {
      const json = doc({
        content: [
          {content: [paragraph(text('一つ目'))], type: 'listItem'},
          {content: [paragraph(text('二つ目'))], type: 'listItem'},
        ],
        type: 'orderedList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('1. 一つ目\n2. 二つ目')
    })

    it('orderedListのattrs.startを開始番号にすること', () => {
      const json = doc({
        attrs: {start: 3},
        content: [
          {content: [paragraph(text('三つ目'))], type: 'listItem'},
          {content: [paragraph(text('四つ目'))], type: 'listItem'},
        ],
        type: 'orderedList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('3. 三つ目\n4. 四つ目')
    })

    it('taskListをチェックボックス記法にすること', () => {
      const json = doc({
        content: [
          {attrs: {checked: false}, content: [paragraph(text('未完了'))], type: 'taskItem'},
          {attrs: {checked: true}, content: [paragraph(text('完了'))], type: 'taskItem'},
        ],
        type: 'taskList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- [ ] 未完了\n- [x] 完了')
    })

    it('taskItemのchecked属性が無い場合は未チェック扱いにすること', () => {
      const json = doc({
        content: [{content: [paragraph(text('属性なし'))], type: 'taskItem'}],
        type: 'taskList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- [ ] 属性なし')
    })

    it('taskList内にネストしたtaskListをリスト記号幅で字下げすること', () => {
      const json = doc({
        content: [
          {
            attrs: {checked: false},
            content: [
              paragraph(text('親')),
              {
                content: [{attrs: {checked: true}, content: [paragraph(text('子'))], type: 'taskItem'}],
                type: 'taskList',
              },
            ],
            type: 'taskItem',
          },
        ],
        type: 'taskList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- [ ] 親\n  - [x] 子')
    })

    it('taskList内にネストしたbulletListをリスト記号幅で字下げすること', () => {
      const json = doc({
        content: [
          {
            attrs: {checked: false},
            content: [
              paragraph(text('親')),
              {content: [{content: [paragraph(text('子'))], type: 'listItem'}], type: 'bulletList'},
            ],
            type: 'taskItem',
          },
        ],
        type: 'taskList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- [ ] 親\n  - 子')
    })

    it('taskItemが複数ブロックを持つ場合もリスト記号幅で字下げすること', () => {
      const json = doc({
        content: [
          {
            attrs: {checked: false},
            content: [paragraph(text('一段目')), paragraph(text('二段目'))],
            type: 'taskItem',
          },
        ],
        type: 'taskList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- [ ] 一段目\n\n  二段目')
    })

    it('bulletList内にネストしたtaskListをtight listとして繋ぐこと', () => {
      const json = doc({
        content: [
          {
            content: [
              paragraph(text('親')),
              {
                content: [{attrs: {checked: false}, content: [paragraph(text('子'))], type: 'taskItem'}],
                type: 'taskList',
              },
            ],
            type: 'listItem',
          },
        ],
        type: 'bulletList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- 親\n  - [ ] 子')
    })

    it('ネストしたbulletListを2スペース字下げしtight listとして繋ぐこと', () => {
      const json = doc({
        content: [
          {
            content: [
              paragraph(text('親')),
              {content: [{content: [paragraph(text('子'))], type: 'listItem'}], type: 'bulletList'},
            ],
            type: 'listItem',
          },
        ],
        type: 'bulletList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- 親\n  - 子')
    })

    it('ネストしたorderedListをマーカー幅で字下げしtight listとして繋ぐこと', () => {
      const json = doc({
        content: [
          {
            content: [
              paragraph(text('親')),
              {content: [{content: [paragraph(text('子'))], type: 'listItem'}], type: 'orderedList'},
            ],
            type: 'listItem',
          },
        ],
        type: 'orderedList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('1. 親\n   1. 子')
    })

    it('listItemが複数段落を持つ場合も字下げを保つこと', () => {
      const json = doc({
        content: [{content: [paragraph(text('1行目')), paragraph(text('2行目'))], type: 'listItem'}],
        type: 'bulletList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('- 1行目\n\n  2行目')
    })
  })

  describe('ブロック要素', () => {
    it('blockquoteの各行に>を付けること', () => {
      const json = doc({content: [paragraph(text('引用1')), paragraph(text('引用2'))], type: 'blockquote'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('> 引用1\n>\n> 引用2')
    })

    it('codeBlockを言語付きフェンスにすること', () => {
      const json = doc({attrs: {language: 'ts'}, content: [text('const a = 1')], type: 'codeBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('```ts\nconst a = 1\n```')
    })

    it('language が auto の場合は言語指定なしにすること', () => {
      const json = doc({attrs: {id: 'c1', language: 'auto'}, content: [text('plain code')], type: 'codeBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('```\nplain code\n```')
    })

    it('codeBlockの内容をエスケープしないこと', () => {
      const json = doc({attrs: {language: 'md'}, content: [text('**not bold** | a')], type: 'codeBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('```md\n**not bold** | a\n```')
    })

    it('horizontalRuleを---にすること', () => {
      const json = doc(paragraph(text('前')), {type: 'horizontalRule'}, paragraph(text('後')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('前\n\n---\n\n後')
    })

    it('imageを![alt](src)にすること', () => {
      const json = doc({attrs: {alt: '図', src: '/document/foo.png'}, type: 'image'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('![図](/document/foo.png)')
    })

    it('altやtitleが無いimageも壊れず出力すること', () => {
      const json = doc({attrs: {height: 448, src: '/document/foo.png', width: 1572}, type: 'image'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('![](/document/foo.png)')
    })

    it('attrsが無いimageも壊れないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc({type: 'image'}))).to.equal('![]()')
    })

    it('imageのtitleを引用符付きで出力すること', () => {
      const json = doc({attrs: {alt: '図', src: '/a.png', title: '説明'}, type: 'image'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('![図](/a.png "説明")')
    })
  })

  describe('テーブル', () => {
    it('tableHeaderを見出し行にして区切り行を入れること', () => {
      const json = doc({
        content: [
          {content: [cell('tableHeader', '名前'), cell('tableHeader', '値')], type: 'tableRow'},
          {content: [cell('tableCell', 'a'), cell('tableCell', '1')], type: 'tableRow'},
        ],
        type: 'table',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('| 名前 | 値 |\n| --- | --- |\n| a | 1 |')
    })

    it('1行目がtableHeaderでなくても区切り行を入れること', () => {
      const json = doc({
        content: [
          {content: [cell('tableCell', 'a'), cell('tableCell', 'b')], type: 'tableRow'},
          {content: [cell('tableCell', 'c'), cell('tableCell', 'd')], type: 'tableRow'},
        ],
        type: 'table',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('| a | b |\n| --- | --- |\n| c | d |')
    })

    it('セル内の|をエスケープすること', () => {
      const json = doc({
        content: [{content: [cell('tableCell', 'a | b')], type: 'tableRow'}],
        type: 'table',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal(String.raw`| a \| b |` + '\n| --- |')
    })

    it('セル内のhardBreakと複数段落を<br>にすること', () => {
      const json = doc({
        content: [
          {
            content: [
              {
                content: [paragraph(text('上'), {type: 'hardBreak'}, text('下')), paragraph(text('次'))],
                type: 'tableCell',
              },
            ],
            type: 'tableRow',
          },
        ],
        type: 'table',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('| 上<br>下<br>次 |\n| --- |')
    })

    it('セルが1つも無いテーブルは出力しないこと', () => {
      const json = doc({content: [{content: [], type: 'tableRow'}], type: 'table'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('')
    })

    it('列数が揃っていない行を空セルで埋めること', () => {
      const json = doc({
        content: [
          {content: [cell('tableHeader', 'a'), cell('tableHeader', 'b')], type: 'tableRow'},
          {content: [cell('tableCell', 'c')], type: 'tableRow'},
        ],
        type: 'table',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('| a | b |\n| --- | --- |\n| c |  |')
    })
  })

  describe('Backlog独自ノード', () => {
    it('issueMentionの課題キーを出力すること', () => {
      const json = doc(paragraph(text('対応: '), {attrs: {issueKey: 'PROJ-123'}, type: 'issueMention'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('対応: PROJ-123')
    })

    it('issueMentionがtext属性のみでも出力すること', () => {
      const json = doc(paragraph({attrs: {text: 'PROJ-9'}, type: 'issueMention'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('PROJ-9')
    })

    it('attachmentBadgeをファイル名で出力すること', () => {
      const json = doc(paragraph({attrs: {name: 'design.pdf'}, type: 'attachmentBadge'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('design.pdf')
    })

    it('attachmentBadgeにsrcがあればリンクにすること', () => {
      const json = doc(paragraph({attrs: {name: 'design.pdf', src: '/attachments/1'}, type: 'attachmentBadge'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('[design.pdf](/attachments/1)')
    })

    it('attrsが不明なattachmentBadgeでも代替ラベルを出すこと', () => {
      const json = doc(paragraph({attrs: {id: 12}, type: 'attachmentBadge'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('添付ファイル')
    })
  })

  describe('未知のノード', () => {
    it('未知のインラインノードの内容を落とさないこと', () => {
      const json = doc(paragraph(text('前'), {content: [text('中身')], type: 'unknownInline'}, text('後')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('前中身後')
    })

    it('未知のブロックノードの子ブロックを段落として保つこと', () => {
      const json = doc({content: [paragraph(text('A')), paragraph(text('B'))], type: 'unknownBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('A\n\nB')
    })

    it('content配列を持たない未知ノードでも壊れないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc({type: 'mystery'}))).to.equal('')
    })
  })

  describe('隣接テキストのマーク結合', () => {
    it('同じマークの連続テキストを1つにまとめること', () => {
      const json = doc(paragraph(text('a', [{type: 'bold'}]), text('b', [{type: 'bold'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**ab**')
    })

    it('italic/strike/codeでも同様にまとめること', () => {
      expect(
        convertDocumentJsonToMarkdown(doc(paragraph(text('a', [{type: 'italic'}]), text('b', [{type: 'italic'}])))),
      ).to.equal('*ab*')
      expect(
        convertDocumentJsonToMarkdown(doc(paragraph(text('a', [{type: 'strike'}]), text('b', [{type: 'strike'}])))),
      ).to.equal('~~ab~~')
      expect(
        convertDocumentJsonToMarkdown(doc(paragraph(text('a', [{type: 'code'}]), text('b', [{type: 'code'}])))),
      ).to.equal('`ab`')
    })

    it('共通の外側マークを1度だけ適用すること（bold + bold+code の隣接）', () => {
      // **a****`b`** のように閉じて開き直すと強調が壊れるため、全体を1つの**で囲う
      const json = doc(paragraph(text('a', [{type: 'bold'}]), text('b', [{type: 'bold'}, {type: 'code'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**a`b`**')
    })

    it('共通マークが無い隣接テキストはそれぞれ包むこと', () => {
      const json = doc(paragraph(text('a', [{type: 'bold'}]), text('b', [{type: 'code'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**a**`b`')
    })

    it('マークが異なる場合はまとめないこと', () => {
      const json = doc(paragraph(text('a', [{type: 'bold'}]), text('b', [{type: 'italic'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**a***b*')
    })

    it('link先が異なる場合はまとめないこと', () => {
      const json = doc(
        paragraph(
          text('a', [{attrs: {href: 'https://a.example'}, type: 'link'}]),
          text('b', [{attrs: {href: 'https://b.example'}, type: 'link'}]),
        ),
      )
      expect(convertDocumentJsonToMarkdown(json)).to.equal('[a](https://a.example)[b](https://b.example)')
    })
  })

  describe('マーク境界の空白', () => {
    it('太字の内側の空白を外に出すこと', () => {
      const json = doc(paragraph(text(' 太字 ', [{type: 'bold'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal(' **太字** ')
    })

    it('斜体・打消でも空白を外に出すこと', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text(' a ', [{type: 'italic'}]))))).to.equal(' *a* ')
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text(' a ', [{type: 'strike'}]))))).to.equal(' ~~a~~ ')
    })

    it('空白のみのテキストは装飾しないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('   ', [{type: 'bold'}]))))).to.equal('   ')
    })
  })

  describe('フェンス・コードスパンの長さ', () => {
    it('内容にバッククォート3連があるcodeBlockは4連フェンスにすること', () => {
      const json = doc({attrs: {language: 'md'}, content: [text('```\nnested\n```')], type: 'codeBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('````md\n```\nnested\n```\n````')
    })

    it('インラインcodeは内容より長い区切りを使うこと', () => {
      const json = doc(paragraph(text('a`b', [{type: 'code'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('``a`b``')
    })

    it('バッククォートで始まる/終わるインラインcodeを空白で隔てること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('`x', [{type: 'code'}]))))).to.equal('`` `x ``')
    })
  })

  describe('番号付きリストの字下げ', () => {
    it('10番以降もマーカー幅で字下げすること', () => {
      const json = doc({
        attrs: {start: 10},
        content: [
          {
            content: [
              paragraph(text('親')),
              {content: [{content: [paragraph(text('子'))], type: 'listItem'}], type: 'bulletList'},
            ],
            type: 'listItem',
          },
        ],
        type: 'orderedList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('10. 親\n    - 子')
    })

    it('startが数値でない場合は1から始めること', () => {
      const json = doc({
        attrs: {start: 'x'},
        content: [{content: [paragraph(text('a'))], type: 'listItem'}],
        type: 'orderedList',
      })
      expect(convertDocumentJsonToMarkdown(json)).to.equal('1. a')
    })
  })

  describe('エスケープ', () => {
    it('行頭の#/>をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('# 見出しではない'))))).to.equal(
        String.raw`\# 見出しではない`,
      )
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('> 引用ではない'))))).to.equal(
        String.raw`\> 引用ではない`,
      )
    })

    it('行頭の-/+をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('- 箇条書きではない'))))).to.equal(
        String.raw`\- 箇条書きではない`,
      )
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('+ 箇条書きではない'))))).to.equal(
        String.raw`\+ 箇条書きではない`,
      )
    })

    it('行頭の番号付きリスト記法をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('1. 項目ではない'))))).to.equal(
        String.raw`1\. 項目ではない`,
      )
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('2) 項目ではない'))))).to.equal(
        String.raw`2\) 項目ではない`,
      )
    })

    it('インラインの*と_をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('TOKYU_UPCPJ'))))).to.equal(String.raw`TOKYU\_UPCPJ`)
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('a*b'))))).to.equal(String.raw`a\*b`)
    })

    it('角括弧・バッククォート・<をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('[a]'))))).to.equal(String.raw`\[a\]`)
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('a`b'))))).to.equal('a\\`b')
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('<tag>'))))).to.equal(String.raw`\<tag>`)
    })

    it('CJKの約物はエスケープしないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('「見出し」（補足）・注記'))))).to.equal(
        '「見出し」（補足）・注記',
      )
    })

    it('codeマーク内はエスケープしないこと', () => {
      const json = doc(paragraph(text('a_b*c', [{type: 'code'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('`a_b*c`')
    })

    it('codeBlock内はエスケープしないこと', () => {
      const json = doc({attrs: {language: 'ts'}, content: [text('const a_b = 1 * 2')], type: 'codeBlock'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('```ts\nconst a_b = 1 * 2\n```')
    })

    it('行頭以外の#はエスケープしないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('a # b'))))).to.equal('a # b')
    })
  })

  describe('URLのエスケープ除外', () => {
    it('URL内の_と*をエスケープしないこと', () => {
      const json = doc(paragraph(text('https://x.com/a_b*c')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('https://x.com/a_b*c')
    })

    it('URL前後のテキストはエスケープすること', () => {
      const json = doc(paragraph(text('a_b https://x.com/p_q c_d')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal(String.raw`a\_b https://x.com/p_q c\_d`)
    })

    it('http／複数URLでも素通しすること', () => {
      const json = doc(paragraph(text('http://a.com/x_1 と https://b.com/y_2')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('http://a.com/x_1 と https://b.com/y_2')
    })
  })

  describe('hardBreak直後の行頭エスケープ', () => {
    it('hardBreak後の#を見出しにしないこと', () => {
      const json = doc(paragraph(text('a'), {type: 'hardBreak'}, text('# b')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a  \n' + String.raw`\# b`)
    })

    it('hardBreak後のリスト記法をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('a'), {type: 'hardBreak'}, text('1. b'))))).to.equal(
        'a  \n' + String.raw`1\. b`,
      )
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('a'), {type: 'hardBreak'}, text('- b'))))).to.equal(
        'a  \n' + String.raw`\- b`,
      )
    })

    it('hardBreak後のsetext下線をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('本文'), {type: 'hardBreak'}, text('==='))))).to.equal(
        '本文  \n' + String.raw`\===`,
      )
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('本文'), {type: 'hardBreak'}, text('---'))))).to.equal(
        '本文  \n' + String.raw`\---`,
      )
    })

    it('=を含むが下線ではない行はエスケープしないこと', () => {
      const json = doc(paragraph(text('a'), {type: 'hardBreak'}, text('a = b')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a  \na = b')
    })
  })

  describe('フェンス・字下げの行頭エスケープ', () => {
    it('~~~をエスケープすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('~~~'))))).to.equal(String.raw`\~~~`)
    })

    it('4スペース以上の字下げを3つに詰めること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('    code?'))))).to.equal('   code?')
    })

    it('3スペースまでの字下げはそのままにすること', () => {
      expect(convertDocumentJsonToMarkdown(doc(paragraph(text('   a'))))).to.equal('   a')
    })
  })

  describe('空テキストノード', () => {
    it('boldの間の空テキストが結合を妨げないこと', () => {
      const json = doc(paragraph(text('a', [{type: 'bold'}]), text(''), text('b', [{type: 'bold'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**ab**')
    })
  })

  describe('hardBreakの前後', () => {
    it('段落末尾のhardBreakを落とすこと', () => {
      const json = doc(paragraph(text('a'), {type: 'hardBreak'}), paragraph(text('b')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a\n\nb')
    })

    it('段落先頭のhardBreakを落とすこと', () => {
      const json = doc(paragraph({type: 'hardBreak'}, text('a')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a')
    })

    it('hardBreakのみの段落は空になること', () => {
      const json = doc(paragraph(text('a')), paragraph({type: 'hardBreak'}), paragraph(text('b')))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a\n\nb')
    })
  })

  describe('リンク先の表記', () => {
    it('空白を含むhrefを<>で囲むこと', () => {
      const json = doc(paragraph(text('a', [{attrs: {href: '/path with space'}, type: 'link'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('[a](</path with space>)')
    })

    it('括弧を含むsrcを<>で囲むこと', () => {
      const json = doc({attrs: {src: '/img(1).png'}, type: 'image'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal('![](</img(1).png>)')
    })

    it('altの角括弧をエスケープすること', () => {
      const json = doc({attrs: {alt: '[図]', src: '/a.png'}, type: 'image'})
      expect(convertDocumentJsonToMarkdown(json)).to.equal(String.raw`![\[図\]](/a.png)`)
    })
  })

  describe('見出しレベル', () => {
    it('attrsが無い見出しはレベル1にすること', () => {
      expect(convertDocumentJsonToMarkdown(doc({content: [text('a')], type: 'heading'}))).to.equal('# a')
    })

    it('範囲外のレベルは1に丸めること', () => {
      expect(convertDocumentJsonToMarkdown(doc({attrs: {level: 9}, content: [text('a')], type: 'heading'}))).to.equal(
        '# a',
      )
      expect(convertDocumentJsonToMarkdown(doc({attrs: {level: 0}, content: [text('a')], type: 'heading'}))).to.equal(
        '# a',
      )
    })

    it('内容が空の見出しは出力しないこと', () => {
      expect(convertDocumentJsonToMarkdown(doc({attrs: {level: 2}, content: [], type: 'heading'}))).to.equal('')
    })
  })

  describe('壊れた構造への耐性', () => {
    it('contentに非オブジェクトが混ざっても無視すること', () => {
      const json = {content: [null, 'x', paragraph(text('a'))], type: 'doc'}
      expect(convertDocumentJsonToMarkdown(json)).to.equal('a')
    })

    it('marksに非オブジェクトが混ざっても無視すること', () => {
      const json = doc(paragraph({marks: [null, {type: 'bold'}], text: 'a', type: 'text'}))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**a**')
    })

    it('未知のマークは最外側に置くこと', () => {
      const json = doc(paragraph(text('a', [{type: 'unknownMark'}, {type: 'bold'}])))
      expect(convertDocumentJsonToMarkdown(json)).to.equal('**a**')
    })

    it('contentが配列でなくても壊れないこと', () => {
      expect(convertDocumentJsonToMarkdown({content: 'x', type: 'doc'})).to.equal('')
    })
  })

  describe('回帰: plainが1行に潰れる不具合', () => {
    it('複数ブロックの本文に改行が入ること', () => {
      // plain では「見出し本文1本文2項目」のように区切りなしで連結されてしまう
      const json = doc(
        {attrs: {level: 2}, content: [text('見出し')], type: 'heading'},
        paragraph(text('本文1')),
        paragraph(text('本文2')),
        {content: [{content: [paragraph(text('項目'))], type: 'listItem'}], type: 'bulletList'},
      )
      const markdown = convertDocumentJsonToMarkdown(json)
      expect(markdown).to.equal('## 見出し\n\n本文1\n\n本文2\n\n- 項目')
    })
  })
})
