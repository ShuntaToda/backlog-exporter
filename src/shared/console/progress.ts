import process from 'node:process'

export function writeProgress(message: string): void {
  if (process.stdout.isTTY) {
    // ESC[K でカーソル位置から行末まで消去し、前の長いメッセージの残骸を防ぐ
    process.stdout.write(`\r\u001B[K${message}`)
  } else {
    // 非TTY（CIログ・パイプ）では \r が効かず1行に連結されるため改行して出力する
    process.stdout.write(`${message}\n`)
  }
}
