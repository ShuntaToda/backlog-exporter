import {createServer} from 'node:http'

import {LoopbackRedirect} from '../domain/authorization.js'

export interface CallbackListener {
  // 認可エンドポイントからリダイレクトされてきたURL
  callbackUrl: Promise<URL>
  close(): Promise<void>
}

const COMPLETED_PAGE = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>backlog-exporter</title></head>
<body><p>ブラウザでの操作は完了しました。ターミナルに戻って結果を確認してください。</p></body></html>`

// 認可コードを受け取るためだけに、リダイレクトURIのポートで一時的にサーバを立てる
export async function listenForCallback(redirect: LoopbackRedirect, timeoutMs: number): Promise<CallbackListener> {
  let resolveCallback!: (url: URL) => void
  let rejectCallback!: (error: Error) => void
  const callbackUrl = new Promise<URL>((resolve, reject) => {
    resolveCallback = resolve
    rejectCallback = reject
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${redirect.hostname}:${redirect.port}`)
    // ブラウザがfavicon等を取りに来るため、リダイレクト先のパス以外は無視する
    if (url.pathname !== redirect.pathname) {
      res.writeHead(404).end()
      return
    }

    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}).end(COMPLETED_PAGE)
    resolveCallback(url)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(
              `ポート ${redirect.port} は他のプロセスが使用中です。別のポートのリダイレクトURIを指定してください`,
            )
          : error,
      )
    })
    server.listen(redirect.port, redirect.hostname, resolve)
  })

  // 待ち受けを始めてから数える（立ち上げに失敗したときにタイマーを残さない）
  const timer = setTimeout(() => {
    rejectCallback(new Error(`${Math.round(timeoutMs / 1000)}秒以内にブラウザでの許可が完了しませんでした`))
  }, timeoutMs)

  return {
    callbackUrl,
    async close() {
      clearTimeout(timer)
      server.closeAllConnections()
      await new Promise((resolve) => {
        server.close(resolve)
      })
    },
  }
}
