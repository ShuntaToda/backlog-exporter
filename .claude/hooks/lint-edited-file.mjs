// 先頭に #! を置かない（node で呼ぶ。Windows の CRLF では vitest が #! を外せず、テストが SyntaxError になる）
// PostToolUse（Edit・Write・MultiEdit）: AI が編集したファイルだけに eslint と prettier をかけ、違反を AI に返す。
// 終了コード 2 のとき、標準エラーの内容が AI に渡る。hook の中の失敗（道具が無い・時間切れ・入力が読めない）では 0 で終え、作業を止めない。
// Bash で書き換えたファイルはここを通らない（Stop の hook と pre-commit が見つける）
import {deadlineOf, lintProblemsOf, lintTargetOf, readHookInput, repoRootOf} from './hook-util.mjs'

/** settings.json の timeout（90 秒）より短くする */
const BUDGET_MS = 80_000

const main = () => {
  const root = repoRootOf(import.meta.url)
  const input = readHookInput()
  const target = lintTargetOf(input?.tool_input?.file_path, root)
  if (target === null) return 0

  const problems = lintProblemsOf(root, [target], deadlineOf(BUDGET_MS))
  if (problems.length === 0) return 0

  process.stderr.write(
    `${target.file} が決まりに合っていません。メッセージのとおりに直してください（eslint-disable で黙らせない。決まりの一覧は AGENTS.md「道具で縛っている決まり」）。\n${problems.join('\n')}\n`,
  )
  return 2
}

try {
  process.exitCode = main()
} catch {
  process.exitCode = 0
}
