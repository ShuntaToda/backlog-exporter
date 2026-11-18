import {Command, Flags} from '@oclif/core'

import {deleteSession} from '../../modules/auth/repository/oauth-session-store.js'

export default class Logout extends Command {
  static description = 'login で保存したOAuthのログイン情報（トークンとClient Secret）を削除する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp
example.backlog.jp のログイン情報を削除する
`,
  ]
  static flags = {
    domain: Flags.string({
      description: 'Backlog domain (e.g. example.backlog.jp)',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Logout)

    if (await deleteSession(flags.domain)) {
      this.log(`${flags.domain} のログイン情報を削除しました`)
    } else {
      this.log(`${flags.domain} のログイン情報はありません`)
    }
  }
}
