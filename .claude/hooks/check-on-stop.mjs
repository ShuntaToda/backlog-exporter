// 先頭に #! を置かない（node で呼ぶ。Windows の CRLF では vitest が #! を外せず、テストが SyntaxError になる）
// Stop: AI が手を止める前に、まだコミットしていない変更を確かめる。
//   1. 変更のあるファイルに eslint と prettier（Bash で書き換えたファイルは、編集のたびの hook を通らないため）
//   2. .ts を変えていれば tsc（1 回に数秒かかるため、編集のたびではなくここで）
// 違反があれば終了コード 2 で AI に返し、続けて直させる。同じ停止で 2 度は止めない（stop_hook_active）。
// hook の中の失敗（git・道具が無い・時間切れ）では 0 で終え、作業を止めない
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'

import {
  changedFilesOf,
  clip,
  deadlineOf,
  lintProblemsOf,
  lintTargetOf,
  readHookInput,
  repoRootOf,
  runTool,
} from './hook-util.mjs'

/** settings.json の timeout（180 秒）より短くする */
const BUDGET_MS = 160_000

/** 変更のあるファイルから、tsc をかけるかを決める（tsconfig.json の include は src と e2e） */
export const needsTypecheck = (changedFiles) =>
  changedFiles.some((file) => /^(src|e2e)\/.+\.ts$/.test(file) || /^tsconfig[^/]*\.json$/.test(file))

const main = () => {
  const input = readHookInput()
  if (input?.stop_hook_active === true) return 0

  const root = repoRootOf(import.meta.url)
  const changedFiles = changedFilesOf(root)
  if (changedFiles === null || changedFiles.length === 0) return 0
  const remaining = deadlineOf(BUDGET_MS)

  const targets = changedFiles.flatMap((file) => {
    const target = lintTargetOf(file, root)
    return target === null ? [] : [target]
  })
  const lintProblems = targets.length === 0 ? [] : lintProblemsOf(root, targets, remaining)

  let typeProblem = null
  if (needsTypecheck(changedFiles)) {
    const result = runTool(root, 'tsc', ['--noEmit'], remaining())
    if (result !== null && !result.ok) typeProblem = clip(result.output)
  }

  if (lintProblems.length === 0 && typeProblem === null) return 0

  const sections = [
    ...(lintProblems.length === 0
      ? []
      : [
          `変更したファイルが決まりに合っていません。メッセージのとおりに直してから終えてください（eslint-disable で黙らせない。決まりの一覧は AGENTS.md「道具で縛っている決まり」）。\n${lintProblems.join('\n')}`,
        ]),
    ...(typeProblem === null
      ? []
      : [
          `型の誤りがあります（tsc）。直してから終えてください（any・@ts-expect-error で黙らせない）。\n${typeProblem}`,
        ]),
  ]
  process.stderr.write(`${sections.join('\n\n')}\n`)
  return 2
}

if (process.argv[1] !== undefined && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main()
  } catch {
    process.exitCode = 0
  }
}
