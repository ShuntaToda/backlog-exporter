import process from 'node:process'

/**
 * 標準入力が対話端末かどうかを返す。
 * 非対話環境（CI・パイプ入力など）では 'data' イベントが発火せず
 * 確認プロンプトが永久に待機してしまうため、プロンプト表示前に確認すること。
 */
export function isInteractiveStdin(): boolean {
  return Boolean(process.stdin.isTTY)
}

/**
 * 標準入力から1行読み取り、y/yes なら true を返す
 */
export async function readYesNo(): Promise<boolean> {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  const response = await new Promise<boolean>((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase()
      resolve(input === 'y' || input === 'yes')
      process.stdin.pause()
    })
  })

  return response
}
