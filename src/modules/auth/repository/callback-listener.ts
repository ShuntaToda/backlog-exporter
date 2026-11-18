import {createServer, IncomingMessage, Server, ServerResponse} from 'node:http'

import {LoopbackRedirect} from '../domain/authorization.js'

export interface CallbackListener {
  // 認可エンドポイントからリダイレクトされてきたURL
  callbackUrl: Promise<URL>
  close(): Promise<void>
}

const COMPLETED_PAGE = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>backlog-exporter</title></head>
<body><p>ブラウザでの操作は完了しました。ターミナルに戻って結果を確認してください。</p></body></html>`

async function listen(server: Server, port: number, address: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, address, () => {
      server.off('error', reject)
      resolve()
    })
  })
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return
  server.closeAllConnections()
  await new Promise((resolve) => {
    server.close(resolve)
  })
}

// 認可コードを受け取るためだけに、リダイレクトURIのポートで一時的にサーバを立てる
export async function listenForCallback(redirect: LoopbackRedirect, timeoutMs: number): Promise<CallbackListener> {
  const settle: {reject?: (error: Error) => void; resolve?: (url: URL) => void} = {}
  const callbackUrl = new Promise<URL>((resolve, reject) => {
    settle.resolve = resolve
    settle.reject = reject
  })
  // ブラウザを開く処理が長引いて待ち始める前に期限が来ても、未処理のrejectionでプロセスを落とさない（呼び出し側がawaitしたときに受け取る）
  callbackUrl.catch(() => {})

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${redirect.hostname}:${redirect.port}`)
    // ブラウザがfavicon等を取りに来るため、リダイレクト先のパス以外は無視する
    if (url.pathname !== redirect.pathname) {
      res.writeHead(404).end()
      return
    }

    // 認可エンドポイントからのリダイレクトは必ずstateかerrorを持つ。それ以外のアクセスで待ちを終わらせない
    if (!url.searchParams.has('state') && !url.searchParams.has('error')) {
      res.writeHead(400).end()
      return
    }

    res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}).end(COMPLETED_PAGE)
    settle.resolve?.(url)
  }

  const servers: Server[] = []
  try {
    const primary = createServer(handle)
    servers.push(primary)
    await listen(primary, redirect.port, redirect.hostname === 'localhost' ? '127.0.0.1' : redirect.hostname)
  } catch (error) {
    await Promise.all(servers.map((server) => closeServer(server)))
    throw (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? new Error(`ポート ${redirect.port} は他のプロセスが使用中です。別のポートのリダイレクトURIを指定してください`)
      : error
  }

  // localhost は環境によって 127.0.0.1 と ::1 のどちらに解決されるかが違い、ブラウザもどちらで繋ぐか分からないため両方で待つ
  if (redirect.hostname === 'localhost') {
    const ipv6 = createServer(handle)
    try {
      await listen(ipv6, redirect.port, '::1')
      servers.push(ipv6)
    } catch {
      // IPv6が無効な環境では127.0.0.1だけで待つ
    }
  }

  // 待ち受けを始めてから数える（立ち上げに失敗したときにタイマーを残さない）
  const timer = setTimeout(() => {
    settle.reject?.(new Error(`${Math.round(timeoutMs / 1000)}秒以内にブラウザでの許可が完了しませんでした`))
  }, timeoutMs)

  return {
    callbackUrl,
    async close() {
      clearTimeout(timer)
      await Promise.all(servers.map((server) => closeServer(server)))
    },
  }
}
