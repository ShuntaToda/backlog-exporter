import process from 'node:process'

// 非対話環境では'data'イベントが発火せず確認プロンプトが永久に待機するため、表示前に必ず確認する
export function isInteractiveStdin(): boolean {
  return Boolean(process.stdin.isTTY)
}

export async function readLine(): Promise<string> {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim())
      process.stdin.pause()
    })
  })
}

export async function readYesNo(): Promise<boolean> {
  const input = (await readLine()).toLowerCase()
  return input === 'y' || input === 'yes'
}
