// 先頭に #! を置かない（node で呼ぶ。Windows の CRLF では vitest が #! を外せず、テストが SyntaxError になる）
// コミットメッセージの決まり（1 行・AI の署名なし）を確かめる（依存なし。Node の組み込みだけ）。
// 手元では lefthook の commit-msg が、CI では PR のコミットの範囲に対してジョブ commit-messages が、同じこのスクリプトを呼ぶ。
//
//   node scripts/check-commit-message.mjs <メッセージのファイル>   （lefthook）
//   node scripts/check-commit-message.mjs --range <元>..<先>       （CI。マージコミットは見ない）
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'

const AI_SIGNATURE = /^(co-authored-by:.*(claude|anthropic|copilot|openai)|claude-session:)/i
/** git revert が付ける本文（戻したコミットを指す。機械が書く決まった形なので、本文として認める） */
const REVERT_BODY = [/^This reverts commit [0-9a-f]{7,40}(\.|, reversing)$/, /^changes made to [0-9a-f]{7,40}\.$/]

/** `git commit -v` が付ける切り取り線。ここから後ろは差分で、メッセージではない */
const SCISSORS = /^\S+ -+ >8 -+$/

const escapeRegExp = (text) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/**
 * エディタで開いたメッセージのファイルから、git の案内のコメントを除く（コミットには残らない行）。
 * 除くのは、コメントの文字（既定は #）だけの行・その後ろが空白（スペース・タブ）の行と、切り取り線から後ろ。
 * git の案内は `# On branch …`・`#<TAB>modified: …`・`# Conflicts:` の形で出る。`#123 を直す` のような件名や、
 * `-m "#本文"` で付けた本文は残す（`-m` で渡した行は、# で始まってもコミットに残る）。`-m "# 本文"` は手元では見分けられないが、
 * CI（--range。コミットに残った文面をそのまま見る）が見つける
 */
export const withoutEditorComments = (fileText, commentChar = '#') => {
  // Windows のエディタが付ける行末の \r は、判定の前に外す
  const all = fileText.split('\n').map((line) => line.replace(/\r$/, ''))
  const scissors = all.findIndex((line) => SCISSORS.test(line))
  const lines = scissors === -1 ? all : all.slice(0, scissors)
  const comment = new RegExp(`^${escapeRegExp(commentChar)}(\\s|$)`)
  return lines.filter((line) => !comment.test(line)).join('\n')
}

/**
 * git のコメントの文字（core.commentString・core.commentChar。既定は #）。
 * auto（メッセージに無い文字を git が選ぶ）のときは、案内の決まった行から読み取る
 */
export const commentCharOf = (fileText, configured) => {
  if (configured !== '' && configured !== 'auto') return configured
  if (configured === 'auto') {
    const guide = /^(\S+) (?:-+ >8 -+|Please enter the commit message)/m.exec(fileText)
    if (guide?.[1] !== undefined) return guide[1]
  }

  return '#'
}

const configuredCommentChar = () => {
  for (const key of ['core.commentString', 'core.commentChar']) {
    const result = spawnSync('git', ['config', '--get', key], {
      encoding: 'utf8',
    })
    if (result.status === 0 && result.stdout.trim() !== '') {
      return result.stdout.trim()
    }
  }

  return ''
}

/** メッセージ（コミットに残る文面）が決まりに合わない点（直し方つき）。合っていれば空 */
export const problemsOf = (message) => {
  const lines = message.split('\n').filter((line) => line.trim() !== '')
  const [subject = '', ...body] = lines
  // 取り消しと、その取り消し（git revert を 2 度かけると Reapply になる）
  const isRevert = /^(Revert|Reapply) "/.test(subject)
  const extra = body.filter((line) => !(isRevert && REVERT_BODY.some((pattern) => pattern.test(line.trim()))))
  return [
    ...(lines.some((line) => AI_SIGNATURE.test(line.trim()))
      ? ['コミットメッセージから AI の署名の行を消してください']
      : []),
    ...(extra.length > 0
      ? [
          'コミットメッセージは 1 行にしてください（本文・箇条書き・トレーラーは付けない。git revert が付ける「This reverts commit …」だけは残してよい）',
        ]
      : []),
  ]
}

const main = (argv) => {
  if (argv[0] === '--range') {
    const range = argv[1] ?? ''
    // マージコミットは見ない（「Update branch」などで GitHub が作り、書いた人が文面を選べない）
    const log = spawnSync('git', ['log', '--no-merges', '--format=%H%x00%B%x01', range, '--'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    if (log.status !== 0) {
      throw new Error(`git log ${range} が失敗しました: ${log.stderr}`)
    }

    const failures = log.stdout
      .split('\u0001')
      .map((entry) => entry.trim().split('\u0000'))
      .flatMap(([hash, message]) =>
        hash === undefined || message === undefined
          ? []
          : problemsOf(message).map((problem) => `${hash.slice(0, 7)} ${message.split('\n')[0]}\n  ${problem}`),
      )
    if (failures.length > 0) {
      throw new Error(`${failures.join('\n')}\n直し方: git rebase -i でメッセージを書き直して push し直してください`)
    }

    return
  }

  const file = argv[0]
  if (file === undefined) {
    throw new Error('使い方: node scripts/check-commit-message.mjs <メッセージのファイル> | --range <元>..<先>')
  }

  const fileText = fs.readFileSync(file, 'utf8')
  const problems = problemsOf(withoutEditorComments(fileText, commentCharOf(fileText, configuredCommentChar())))
  if (problems.length > 0) throw new Error(problems.join('\n'))
}

if (process.argv[1] !== undefined && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
