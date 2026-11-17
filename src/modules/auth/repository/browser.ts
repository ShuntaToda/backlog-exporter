import {spawn} from 'node:child_process'
import process from 'node:process'

// 開けなくてもURLは表示しているので、利用者が自分で開けば続けられる。そのため失敗は投げずにfalseを返す
export async function openBrowser(url: string): Promise<boolean> {
  const [command, args] = browserCommand(url)
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {detached: true, stdio: 'ignore'})
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}

function browserCommand(url: string): [string, string[]] {
  switch (process.platform) {
    case 'darwin': {
      return ['open', [url]]
    }

    case 'win32': {
      // startはcmdの組み込みコマンド。最初の引用符付き引数はウィンドウタイトルとして扱われるため空文字を渡す
      return ['cmd', ['/c', 'start', '""', url.replaceAll('&', '^&')]]
    }

    default: {
      return ['xdg-open', [url]]
    }
  }
}
