import {Command, Flags} from '@oclif/core'

import {loginDeps} from '../../composition/backlog-auth.js'
import {DEFAULT_REDIRECT_URI} from '../../modules/auth/domain/authorization.js'
import {login} from '../../modules/auth/use-case/login.js'
import {loadDotenv} from '../../shared/config/env.js'

// .envファイルを読み込む
loadDotenv()

export default class Login extends Command {
  static description =
    'BacklogにOAuth 2.0でログインし、APIキーを発行せずにエクスポートできるようにする（Backlog Developerサイトで登録したアプリケーションを使う）'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp
環境変数 BACKLOG_OAUTH_CLIENT_ID / BACKLOG_OAUTH_CLIENT_SECRET のアプリケーションでログインする
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --redirectUri http://localhost:8080/callback
アプリケーションに登録したリダイレクトURIが既定値と違う場合に指定する
`,
  ]
  static flags = {
    clientId: Flags.string({
      description: '登録したアプリケーションのClient ID（環境変数 BACKLOG_OAUTH_CLIENT_ID からも自動読み取り可能）',
      env: 'BACKLOG_OAUTH_CLIENT_ID',
      required: true,
    }),
    clientSecret: Flags.string({
      description:
        '登録したアプリケーションのClient Secret（シェルの履歴に残らないよう、環境変数 BACKLOG_OAUTH_CLIENT_SECRET での指定を推奨）',
      env: 'BACKLOG_OAUTH_CLIENT_SECRET',
      required: true,
    }),
    domain: Flags.string({
      description: 'Backlog domain (e.g. example.backlog.jp)',
      required: true,
    }),
    redirectUri: Flags.string({
      default: DEFAULT_REDIRECT_URI,
      description:
        'アプリケーションに登録したリダイレクトURI（環境変数 BACKLOG_OAUTH_REDIRECT_URI からも自動読み取り可能）',
      env: 'BACKLOG_OAUTH_REDIRECT_URI',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)
    const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}

    try {
      await login(loginDeps(logger), {
        client: {clientId: flags.clientId, clientSecret: flags.clientSecret, redirectUri: flags.redirectUri},
        domain: flags.domain,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`ログインに失敗しました: ${errorMessage}`)
    }
  }
}
