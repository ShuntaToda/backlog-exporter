import {Args, Command, Flags} from '@oclif/core'
import process from 'node:process'

import {createBacklogRepositories} from '../../composition/backlog-repositories.js'
import {pruneDirectories} from '../../modules/prune/use-case/prune-directories.js'
import {loadDotenv} from '../../shared/config/env.js'
import {isInteractiveStdin, readYesNo} from '../../shared/console/prompt.js'

// .envファイルを読み込む
loadDotenv()

export default class Prune extends Command {
  static args = {
    directory: Args.string({
      description: '対象ディレクトリ（設定ファイルが保存されている場所）',
      required: false,
    }),
  }
  static description =
    'Backlog上で削除・移動されたドキュメント・Wikiのローカルファイルを削除し、Backlogと同じ状態に揃える'
  static examples = [
    `<%= config.bin %> <%= command.id %>
カレントディレクトリ配下の設定ファイルを探索し、Backlog上に存在しないドキュメントファイルを削除する
`,
    `<%= config.bin %> <%= command.id %> ./backlog-documents
指定したディレクトリを対象にする
`,
    `<%= config.bin %> <%= command.id %> --force
確認プロンプトをスキップして削除する
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: 'Backlog API key (環境変数 BACKLOG_API_KEY からも自動読み取り可能)',
      required: false,
    }),
    domain: Flags.string({
      description: 'Backlog domain (e.g. example.backlog.jp)',
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: '確認プロンプトをスキップする',
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: 'Backlog project ID or key',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Prune)
    const targetDir = args.directory || process.cwd()

    const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}

    try {
      await pruneDirectories(
        {createRepositories: createBacklogRepositories, logger},
        {
          confirmDirectory: (directory) => this.confirmPrune(directory, flags.force ?? false),
          flags: {
            apiKey: flags.apiKey,
            domain: flags.domain,
            projectIdOrKey: flags.projectIdOrKey,
          },
          rootDir: targetDir,
        },
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`pruneに失敗しました: ${errorMessage}`)
    }
  }

  // 削除実行前の確認プロンプト（--force 時はスキップ）
  private async confirmPrune(targetDir: string, force: boolean): Promise<boolean> {
    if (force) {
      return true
    }

    // 非対話環境（CI・パイプ入力など）では 'data' イベントが発火せず永久に待機してしまうため、
    // プロンプトを出さずにエラーとして終了する
    if (!isInteractiveStdin()) {
      this.error(
        '対話的な確認ができない環境のため中止しました（標準入力が端末ではありません）。--force フラグを付けると確認をスキップして実行できます。',
      )
    }

    this.log('以下のディレクトリで、Backlog上に存在しないドキュメント・Wiki（.mdファイル）を削除します:')
    this.log(`- ディレクトリ: ${targetDir}`)
    this.log('削除を実行しますか？ (y/n)')

    const response = await readYesNo()

    if (!response) {
      this.log('pruneをキャンセルしました')
    }

    return response
  }
}
