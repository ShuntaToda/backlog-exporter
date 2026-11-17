import {describe, expect, test} from 'vitest'

import {commentCharOf, problemsOf, withoutEditorComments} from './check-commit-message.mjs'

describe('problemsOf', () => {
  test.each([
    ['1 行', 'コメントの並びを直す\n'],
    ['# で始まる件名', '#123 を直す\n'],
    [
      '取り消しの取り消し（Reapply）の決まった本文',
      'Reapply "コメントの並びを直す"\n\nThis reverts commit 0123456789abcdef0123456789abcdef01234567.\n',
    ],
    [
      'git revert の決まった本文',
      'Revert "コメントの並びを直す"\n\nThis reverts commit 0123456789abcdef0123456789abcdef01234567.\n',
    ],
    [
      'マージの取り消しの決まった本文',
      'Revert "Merge branch"\n\nThis reverts commit 0123456789abcdef0123456789abcdef01234567, reversing\nchanges made to 89abcdef0123456789abcdef0123456789abcdef.\n',
    ],
  ])('[正常系]%s は通す', (_, message) => {
    expect(problemsOf(message)).toStrictEqual([])
  })

  test.each([
    ['本文つき', '直す\n\nくわしい説明\n', /1 行に/],
    ['箇条書きつき', '直す\n- a\n- b\n', /1 行に/],
    ['トレーラーつき', '直す\n\nSigned-off-by: 山田 太郎 <taro@example.com>\n', /1 行に/],
    ['AI の署名つき', '直す\n\nCo-Authored-By: Claude <noreply@example.com>\n', /AI の署名/],
    ['セッションの URL つき', '直す\n\nClaude-Session: https://example.com/s\n', /AI の署名/],
    ['revert に足した本文', 'Revert "直す"\n\nThis reverts commit 0123456.\nやっぱり戻す\n', /1 行に/],
    ['# で始まる本文（-m で付けたもの。コミットに残る）', '直す\n\n#本文\n', /1 行に/],
    ['# で始まる件名と本文', '#123 を直す\n本文\n', /1 行に/],
    ['案内の形をした本文（--range ではコミットに残った文面）', '直す\n\n# 本文\n', /1 行に/],
    ['revert でないのに revert の本文', '直す\n\nThis reverts commit 0123456.\n', /1 行に/],
  ])('[異常系]%s は、直し方を返す', (_, message, problem) => {
    expect(problemsOf(message).join('\n')).toMatch(problem)
  })
})

describe('withoutEditorComments', () => {
  test('[正常系]git の案内（# と「# 」で始まる行）と、切り取り線から後ろを除く', () => {
    expect(
      problemsOf(
        withoutEditorComments(
          [
            'コメントの並びを直す',
            '',
            '# Please enter the commit message for your changes.',
            '#',
            '# On branch main',
            '# ------------------------ >8 ------------------------',
            '# Do not modify or remove the line above.',
            'diff --git a/a.ts b/a.ts',
            '+const a = 1;',
            '',
          ].join('\n'),
        ),
      ),
    ).toStrictEqual([])
  })

  test(String.raw`[正常系]タブで始まる案内（#<TAB>modified:）・競合の一覧・行末の \r も除く`, () => {
    expect(
      problemsOf(
        withoutEditorComments(
          [
            "Merge branch 'feature' into main",
            '',
            '# Conflicts:',
            '#\tapi/a.ts',
            '#',
            '# It looks like you may be committing a merge.',
            '# Changes to be committed:',
            '#\tmodified:   api/a.ts',
            '#\tnew file:   api/b.ts',
            '',
          ].join('\r\n'),
        ),
      ),
    ).toStrictEqual([])
  })

  test('[正常系]コメントの文字を変えていれば（core.commentChar）、その文字の行を除き、# の行は本文として数える', () => {
    const fileText = '直す\n\n; Please enter the commit message\n;\tmodified: a.ts\n'

    expect(problemsOf(withoutEditorComments(fileText, ';'))).toStrictEqual([])
    expect(problemsOf(withoutEditorComments('直す\n\n# 本文\n', ';')).join('\n')).toMatch(/1 行に/)
  })

  test.each([
    ['-m で付けた # の本文', '直す\n\n#本文\n'],
    ['# で始まる件名の後ろの本文', '#123 を直す\n本文\n# Please enter the commit message\n'],
  ])('[異常系]%s は除かず、1 行の決まりで落ちる', (_, fileText) => {
    expect(problemsOf(withoutEditorComments(fileText)).join('\n')).toMatch(/1 行に/)
  })
})

describe('commentCharOf', () => {
  test.each([
    ['設定なしは #', '直す\n', '', '#'],
    ['設定した文字', '直す\n', ';', ';'],
    ['auto は案内の行から読む', '直す\n\n% Please enter the commit message for your changes.\n', 'auto', '%'],
    ['auto で案内が無ければ #', '直す\n', 'auto', '#'],
  ])('[正常系]%s', (_, fileText, configured, expected) => {
    expect(commentCharOf(fileText, configured)).toBe(expected)
  })
})
