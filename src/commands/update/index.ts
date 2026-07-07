import {Args, Command, Flags} from '@oclif/core'
import process from 'node:process'

import {createBacklogRepositories} from '../../composition/backlog-repositories.js'
import {updateExports} from '../../modules/update/use-case/update-exports.js'
import {loadDotenv} from '../../shared/config/env.js'

// .envファイルを読み込む
loadDotenv()

export default class Update extends Command {
  static args = {
    directory: Args.string({
      description: '更新対象のディレクトリ（設定ファイルが保存されている場所）',
      required: false,
    }),
  }
  static description = 'Backlogから最新データを取得して更新する'
  static examples = [
    `<%= config.bin %> <%= command.id %>
カレントディレクトリの設定を使用して更新する
`,
    `<%= config.bin %> <%= command.id %> --force
確認プロンプトをスキップする
`,
    `<%= config.bin %> <%= command.id %> --apiKey YOUR_API_KEY --domain example.backlog.jp --projectIdOrKey PROJECT_KEY
指定したパラメータで更新する（設定ファイルが存在する場合は上書きされます）
`,
    `<%= config.bin %> <%= command.id %> ./my-project
指定したディレクトリの設定を使用して更新する
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFileName
ファイル名を課題キーにする
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFolder
課題キーでフォルダを作成する
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFileName --issueKeyFolder
課題キーでフォルダを作成し、ファイル名も課題キーにする
`,
    `<%= config.bin %> <%= command.id %> --issueIdOrKey PROJECT-1,PROJECT-2
指定した課題（IDまたはキー）のみを再取得する（全件差分更新は行わない）
`,
    `<%= config.bin %> <%= command.id %> --wikiId 12345,12346
指定したWiki（ID）のみを再取得する（全件差分更新は行わない）
`,
    `<%= config.bin %> <%= command.id %> --documentId abc123,def456
指定したドキュメント（ID）のみを再取得する（全件差分更新は行わない）
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: 'Backlog API key (環境変数 BACKLOG_API_KEY からも自動読み取り可能)',
      required: false,
    }),
    documentId: Flags.string({
      description: '指定したドキュメント（ID）のみを再取得する（カンマ区切りで複数指定可能）',
      required: false,
    }),
    documentsOnly: Flags.boolean({
      description: 'ドキュメントのみを更新する',
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
    issueIdOrKey: Flags.string({
      description: '指定した課題（IDまたはキー）のみを再取得する（カンマ区切りで複数指定可能）',
      required: false,
    }),
    issueKeyFileName: Flags.boolean({
      description: 'ファイル名を課題キーにする',
      required: false,
    }),
    issueKeyFolder: Flags.boolean({
      description: '課題キーでフォルダを作成する',
      required: false,
    }),
    issuesOnly: Flags.boolean({
      description: '課題のみを更新する',
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: 'Backlog project ID or key',
      required: false,
    }),
    wikiId: Flags.string({
      description: '指定したWiki（ID）のみを再取得する（カンマ区切りで複数指定可能）',
      required: false,
    }),
    wikisOnly: Flags.boolean({
      description: 'Wikiのみを更新する',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Update)

    // 更新対象のディレクトリを決定（指定がなければカレントディレクトリ）
    const targetDir = args.directory || process.cwd()

    const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}

    try {
      await updateExports({createRepositories: createBacklogRepositories, logger}, targetDir, flags)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`更新に失敗しました: ${errorMessage}`)
    }
  }
}
