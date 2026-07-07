import process from 'node:process'

// 非対話環境では'data'イベントが発火せず確認プロンプトが永久に待機するため、表示前に必ず確認する
export function isInteractiveStdin(): boolean {
  return Boolean(process.stdin.isTTY)
}

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
