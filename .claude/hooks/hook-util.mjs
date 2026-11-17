// Claude Code の hook で使う共通の処理（依存なし。Node の組み込みだけ）。
// hook が壊れても作業を止めないよう、呼ぶ側は例外をすべて握って exit 0 にする
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

/** 検査の出力のうち、AI に返す行数の上限（長い出力で文脈を埋めない） */
const MAX_OUTPUT_LINES = 40

/** 道具の出力を受ける上限（既定の 1MB を超えると spawnSync が失敗し、違反が「確かめられなかった」に化ける） */
const MAX_BUFFER = 32 * 1024 * 1024

/** hook のファイルの場所から、リポジトリの根を決める */
export const repoRootOf = (hookUrl) => path.resolve(path.dirname(fileURLToPath(hookUrl)), '../..')

/** シンボリックリンクをたどった先のパス。まだ無いファイルは、ある所までの親をたどる */
const realPathOf = (target) => {
  try {
    return fs.realpathSync(target)
  } catch {
    const parent = path.dirname(target)
    return parent === target ? target : path.join(realPathOf(parent), path.basename(target))
  }
}

/** 標準入力の JSON（hook の入力）を読む。読めなければ空のオブジェクト */
export const readHookInput = () => {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

/** 編集されたファイルを、どの道具で確かめるかを決める。確かめないファイルは null */
export const lintTargetOf = (filePath, root) => {
  if (typeof filePath !== 'string' || filePath === '') return null
  // 根も編集されたファイルも実体のパスで比べる（リンク越しに開いた根でも、根の外を指すリンクでも、見誤らない）
  const relative = path
    .relative(realPathOf(root), realPathOf(path.resolve(root, filePath)))
    .split(path.sep)
    .join('/')
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  if (/(^|\/)(node_modules|dist|coverage)\//.test(relative)) return null
  // oclif が作る生成物
  if (relative === 'oclif.manifest.json') return null
  const eslint =
    /^(src|e2e)\/.+\.ts$/.test(relative) ||
    /^(scripts|\.claude\/hooks)\/[^/]+\.mjs$/.test(relative) ||
    /^[^/]+\.(mjs|ts)$/.test(relative)
  const prettier = eslint || /\.(ts|json|md|yml|yaml|mjs)$/.test(relative)
  return prettier ? {eslint, file: relative} : null
}

/**
 * hook 全体の持ち時間。settings.json の timeout（秒）より短くし、外から打ち切られる前に自分で終える
 * （打ち切られると、そこまでに見つけた違反も AI に返らない）
 */
export const deadlineOf = (budgetMs) => {
  const end = Date.now() + budgetMs
  return () => end - Date.now()
}

/** git status --porcelain -z の出力を読む（名前を変えたものは、新しい名前の後ろに元の名前が続く。消したものは除く） */
export const parseStatus = (output) => {
  const entries = output.split('\0')
  const files = []
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (entry.length < 4) continue
    const code = entry.slice(0, 2)
    if (/[CR]/.test(code)) i += 1
    if (!/D/.test(code)) files.push(entry.slice(3))
  }

  return files
}

/** 変更のあるファイル（まだコミットしていないもの。根からの相対パス）。git が使えなければ null */
export const changedFilesOf = (root) => {
  const status = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: 10_000,
  })
  if (status.error !== undefined || status.status !== 0) return null
  return parseStatus(status.stdout)
}

/** node_modules/.bin の道具を動かす。道具が無い・時間切れは「確かめられなかった」として null */
export const runTool = (root, tool, args, timeoutMs) => {
  // Windows では .bin の道具が .cmd になる
  const bin = path.join(root, 'node_modules/.bin', process.platform === 'win32' ? `${tool}.cmd` : tool)
  if (!fs.existsSync(bin) || timeoutMs <= 0) return null
  const result = spawnSync(bin, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    shell: process.platform === 'win32',
    timeout: timeoutMs,
  })
  if (result.error !== undefined || result.status === null) return null
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  }
}

/** 出力を上限の行数に切る */
export const clip = (output) => {
  const lines = output.split('\n')
  return lines.length <= MAX_OUTPUT_LINES
    ? output
    : `${lines.slice(0, MAX_OUTPUT_LINES).join('\n')}\n…（残り ${lines.length - MAX_OUTPUT_LINES} 行）`
}

/** 英語のままのメッセージに、直し方を添える */
const HINTS = [
  [
    'Dependency cycle detected',
    '循環 import（Dependency cycle detected）: 2 つのファイルが互いを import しています。両方が使う型・関数を、どちらからも参照できる別のファイル（より内側の層）へ移してください。',
  ],
  [
    'Unexpected console statement',
    'modules では console を使いません。Logger（src/shared/ports.ts）を引数で受けて使ってください。',
  ],
  [
    'Forbidden non-null assertion',
    '! で null を外しません。undefined のときの扱いを書く（早めに return する・既定値を置く・エラーを投げる）か、型を絞ってください。',
  ],
]

/**
 * ファイルの組に eslint と prettier をかけ、違反の文を返す（無ければ空）。
 * remaining は残りの持ち時間（ミリ秒）を返す関数
 */
export const lintProblemsOf = (root, targets, remaining) => {
  const problems = []
  const eslintFiles = targets.filter((t) => t.eslint).map((t) => t.file)
  if (eslintFiles.length > 0) {
    const eslint = runTool(
      root,
      'eslint',
      ['--cache', '--max-warnings', '0', '--no-warn-ignored', '--', ...eslintFiles],
      remaining(),
    )
    if (eslint !== null && !eslint.ok) {
      const hints = HINTS.filter(([needle]) => eslint.output.includes(needle)).map(([, hint]) => hint)
      // 切るのは eslint の出力だけ。直し方の添え書きと、下の整形の案内は、切った後ろに必ず付ける
      problems.push([clip(eslint.output), ...hints].join('\n'))
    }
  }

  const prettier = runTool(
    root,
    'prettier',
    ['--list-different', '--ignore-unknown', '--', ...targets.map((t) => t.file)],
    remaining(),
  )
  if (prettier !== null && !prettier.ok) {
    const files = prettier.output
      .split('\n')
      .filter((line) => line !== '')
      .map((file) => `'${file}'`)
    problems.push(
      `整形が決まりと違います。リポジトリの根で \`npx prettier --write -- ${files.join(' ')}\` を実行して直してください。`,
    )
  }

  return problems
}
