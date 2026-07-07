import {createServer, Server} from 'node:http'
import {AddressInfo} from 'node:net'

export interface MockResponse {
  body?: unknown
  status?: number
}

export type MockResponder = ((url: URL) => MockResponse) | MockResponse

// Backlog APIを模した極小HTTPサーバ。実HTTP通信でクライアント〜CLIを検証するテスト用。
// 未定義のパスへのリクエストは404を返し、全リクエストを記録する。
export class BacklogMockServer {
  readonly requests: URL[] = []
  private readonly onceRoutes: Array<{pathname: string; responder: MockResponder}> = []
  private readonly routes = new Map<string, MockResponder>()
  private server?: Server

  get domain(): string {
    const {port} = this.server!.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  requestedPaths(): string[] {
    return this.requests.map((url) => url.pathname)
  }

  reset(): void {
    this.onceRoutes.length = 0
    this.routes.clear()
    this.requests.length = 0
  }

  respond(pathname: string, responder: MockResponder): void {
    this.routes.set(pathname, responder)
  }

  respondOnce(pathname: string, responder: MockResponder): void {
    this.onceRoutes.push({pathname, responder})
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      this.requests.push(url)

      const onceIndex = this.onceRoutes.findIndex((route) => route.pathname === url.pathname)
      const responder =
        onceIndex === -1 ? this.routes.get(url.pathname) : this.onceRoutes.splice(onceIndex, 1)[0].responder

      if (responder === undefined) {
        res.writeHead(404, {'content-type': 'application/json'})
        res.end(JSON.stringify({errors: [{message: `no mock for ${url.pathname}`}]}))
        return
      }

      const {body = {}, status = 200} = typeof responder === 'function' ? responder(url) : responder
      res.writeHead(status, {'content-type': 'application/json'})
      res.end(JSON.stringify(body))
    })

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', resolve)
    })
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => {
      this.server?.close(resolve)
    })
  }
}
