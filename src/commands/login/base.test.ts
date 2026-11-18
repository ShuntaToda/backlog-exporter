import {describe, expect, it} from 'vitest'

import Login from './index.js'

describe('Loginコマンド - 基本機能', () => {
  it('Client ID/Secretは環境変数からも読み取れること', () => {
    const {flags} = Login

    expect(flags.clientId.env).to.equal('BACKLOG_OAUTH_CLIENT_ID')
    expect(flags.clientSecret.env).to.equal('BACKLOG_OAUTH_CLIENT_SECRET')
    expect(flags.redirectUri.env).to.equal('BACKLOG_OAUTH_REDIRECT_URI')
  })

  it('リダイレクトURIの既定値は手元のマシンを指すこと', () => {
    expect(Login.flags.redirectUri.default).to.equal('http://localhost:5033/callback')
  })

  it('ドメインは必須であること', () => {
    expect(Login.flags.domain.required).to.be.true
  })
})
