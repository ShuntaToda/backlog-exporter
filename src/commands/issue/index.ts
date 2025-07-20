import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'

import {downloadIssues} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class Issue extends Command {
  static description = 'Backlogから課題を取得してMarkdownファイルとして保存する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
課題をMarkdownファイルとして保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-issues
指定したディレクトリに課題を保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --statusId 1,2,3
指定したステータスIDの課題のみを取得する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --maxCount 10000
最大10000件の課題を取得する（デフォルトは5000件）
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --useIssueKeyFolder
課題キーでフォルダを作成し、その中に課題キー名のMarkdownファイルを出力する
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: 'Backlog API key (環境変数 BACKLOG_API_KEY からも自動読み取り可能)',
      required: false,
    }),
    domain: Flags.string({
      description: 'Backlog domain (e.g. example.backlog.jp)',
      required: true,
    }),
    maxCount: Flags.integer({
      char: 'm',
      default: 5000,
      description: '一度に取得する課題の最大数（デフォルト: 5000）',
      required: false,
    }),
    output: Flags.string({
      char: 'o',
      description: '出力ディレクトリパス',
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: 'Backlog project ID or key',
      required: true,
    }),
    statusId: Flags.string({
      description: 'ステータスID（カンマ区切りで複数指定可能）',
      required: false,
    }),
    useIssueKeyFolder: Flags.boolean({
      description: '課題キーでフォルダを作成し、その中に課題キー名のMarkdownファイルを出力する',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Issue)

    try {
      const {domain, maxCount, projectIdOrKey, statusId, useIssueKeyFolder} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputDir = flags.output || './backlog-issues'

      // 出力ディレクトリの作成
      await createOutputDirectory(outputDir)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      this.log(`プロジェクトID: ${projectId} を使用します`)

      // 設定ファイルを保存
      await updateSettings(outputDir, {
        apiKey,
        domain,
        folderType: FolderType.ISSUE,
        outputDir,
        projectIdOrKey,
      })

      // 課題の取得と保存
      await downloadIssues(this, {
        apiKey,
        count: maxCount,
        domain,
        outputDir,
        projectId,
        statusId,
        useIssueKeyFolder,
      })

      // 最終更新日時を更新
      await updateSettings(outputDir, {
        lastUpdated: new Date().toISOString(),
      })

      this.log('課題の取得が完了しました！')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`課題の取得に失敗しました: ${errorMessage}`)
    }
  }
}
