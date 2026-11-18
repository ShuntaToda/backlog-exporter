import {describe, expect, it} from 'vitest'

import {buildAuthorizationUrl, parseLoopbackRedirectUri, readAuthorizationCallback} from './authorization.js'

const CLIENT = {clientId: 'client-id', clientSecret: 'secret', redirectUri: 'http://localhost:5033/callback'}

describe('parseLoopbackRedirectUri', () => {
  it('localhostのリダイレクトURIからポートとパスを取り出すこと', () => {
    expect(parseLoopbackRedirectUri('http://localhost:5033/callback')).to.deep.equal({
      hostname: 'localhost',
      pathname: '/callback',
      port: 5033,
    })
  })

  it('127.0.0.1も受け付けること', () => {
    expect(parseLoopbackRedirectUri('http://127.0.0.1:8080/cb').hostname).to.equal('127.0.0.1')
  })

  it('手元のマシン以外のホストは拒否すること', () => {
    expect(() => parseLoopbackRedirectUri('http://example.com:5033/callback')).to.throw('http://localhost')
  })

  it('httpsは拒否すること（手元のサーバは証明書を持たないため）', () => {
    expect(() => parseLoopbackRedirectUri('https://localhost:5033/callback')).to.throw('http://localhost')
  })

  it('ポートの無いURIは拒否すること', () => {
    expect(() => parseLoopbackRedirectUri('http://localhost/callback')).to.throw('ポート番号')
  })

  it('URIとして読めない値は拒否すること', () => {
    expect(() => parseLoopbackRedirectUri('localhost:5033')).to.throw()
    expect(() => parseLoopbackRedirectUri('not a uri')).to.throw('形式')
  })
})

describe('buildAuthorizationUrl', () => {
  it('スペースの認可エンドポイントにClient ID・リダイレクトURI・stateを付けること', () => {
    const url = new URL(buildAuthorizationUrl('example.backlog.jp', CLIENT, 'the-state'))

    expect(url.origin + url.pathname).to.equal('https://example.backlog.jp/OAuth2AccessRequest.action')
    expect([...url.searchParams]).to.deep.equal([
      ['response_type', 'code'],
      ['client_id', 'client-id'],
      ['redirect_uri', 'http://localhost:5033/callback'],
      ['state', 'the-state'],
    ])
  })
})

const callback = (query: string) => new URL(`http://localhost:5033/callback?${query}`)

describe('readAuthorizationCallback', () => {
  it('stateが一致すれば認可コードを返すこと', () => {
    expect(readAuthorizationCallback(callback('code=abc&state=s1'), 's1')).to.equal('abc')
  })

  it('stateが一致しなければ拒否すること', () => {
    expect(() => readAuthorizationCallback(callback('code=abc&state=other'), 's1')).to.throw('state')
  })

  it('stateが無ければ拒否すること', () => {
    expect(() => readAuthorizationCallback(callback('code=abc'), 's1')).to.throw('state')
  })

  it('許可されなかったときはエラーの内容を伝えること', () => {
    expect(() =>
      readAuthorizationCallback(callback('error=access_denied&error_description=denied&state=s1'), 's1'),
    ).to.throw('access_denied (denied)')
  })

  it('認可コードが無ければ拒否すること', () => {
    expect(() => readAuthorizationCallback(callback('state=s1'), 's1')).to.throw('認可コード')
  })
})
