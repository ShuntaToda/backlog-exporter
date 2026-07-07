import process from 'node:process'

/**
 * 進捗状況を同じ行に上書き表示する（行頭復帰してから書き込む）
 */
export function writeProgress(message: string): void {
  process.stdout.write(`\r${message}`)
}
