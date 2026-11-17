import {createServer} from 'node:http'
import {AddressInfo} from 'node:net'
import {describe, expect, it} from 'vitest'

import {listenForCallback} from './callback-listener.js'

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const {port} = server.address() as AddressInfo
  await new Promise((resolve) => {
    server.close(resolve)
  })
  return port
}

describe('listenForCallback', () => {
  it('リダイレクト先のパスへのリクエストでURLを返し、完了ページを表示すること', async () => {
    const port = await freePort()
    const listener = await listenForCallback({hostname: '127.0.0.1', pathname: '/callback', port}, 5000)

    try {
      const favicon = await fetch(`http://127.0.0.1:${port}/favicon.ico`)
      expect(favicon.status).to.equal(404)

      const page = await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=s1`)
      expect(await page.text()).to.include('ターミナルに戻って')

      const url = await listener.callbackUrl
      expect(url.searchParams.get('code')).to.equal('abc')
    } finally {
      await listener.close()
    }
  })

  it('stateもerrorも無いアクセスでは待ちを終わらせないこと', async () => {
    const port = await freePort()
    const listener = await listenForCallback({hostname: '127.0.0.1', pathname: '/callback', port}, 5000)

    try {
      const stray = await fetch(`http://127.0.0.1:${port}/callback`)
      expect(stray.status).to.equal(400)

      await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=s1`)
      expect((await listener.callbackUrl).searchParams.get('state')).to.equal('s1')
    } finally {
      await listener.close()
    }
  })

  it('localhostならIPv4で受け取れること', async () => {
    const port = await freePort()
    const listener = await listenForCallback({hostname: 'localhost', pathname: '/callback', port}, 5000)

    try {
      await fetch(`http://127.0.0.1:${port}/callback?error=access_denied`)
      expect((await listener.callbackUrl).searchParams.get('error')).to.equal('access_denied')
    } finally {
      await listener.close()
    }
  })

  it('期限までに戻ってこなければエラーにすること', async () => {
    const port = await freePort()
    const listener = await listenForCallback({hostname: '127.0.0.1', pathname: '/callback', port}, 10)

    try {
      await expect(listener.callbackUrl).rejects.toThrow('許可が完了しませんでした')
    } finally {
      await listener.close()
    }
  })

  it('ポートが使用中なら別のリダイレクトURIを促すこと', async () => {
    const port = await freePort()
    const first = await listenForCallback({hostname: '127.0.0.1', pathname: '/callback', port}, 5000)

    try {
      await expect(listenForCallback({hostname: '127.0.0.1', pathname: '/callback', port}, 5000)).rejects.toThrow(
        '使用中',
      )
    } finally {
      await first.close()
    }
  })
})
