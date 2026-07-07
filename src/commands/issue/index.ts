import {Command, Flags} from '@oclif/core'

import {FolderType} from '../../domain/settings.js'
import {BacklogHttpClient} from '../../infrastructure/backlog/http-client.js'
import {validateAndGetProjectId} from '../../infrastructure/backlog/project-api.js'
import {API_KEY_NOT_FOUND_MESSAGE, loadDotenv, resolveApiKey} from '../../infrastructure/env.js'
import {ensureDirectory} from '../../infrastructure/storage/markdown-store.js'
import {updateSettings} from '../../infrastructure/storage/settings-store.js'
import {exportIssues} from '../../usecases/export-issues.js'

// .envファイルを読み込む
loadDotenv()

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
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName
ファイル名を課題キーにする
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFolder
課題キーでフォルダを作成する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName --issueKeyFolder
課題キーでフォルダを作成し、ファイル名も課題キーにする
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
    issueKeyFileName: Flags.boolean({
      description: 'ファイル名を課題キーにする',
      required: false,
    }),
    issueKeyFolder: Flags.boolean({
      description: '課題キーでフォルダを作成する',
      required: false,
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
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Issue)

    try {
      const {domain, issueKeyFileName, issueKeyFolder, maxCount, projectIdOrKey, statusId} = flags
      const apiKey =
        resolveApiKey(flags.apiKey, () => this.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します')) ??
        this.error(API_KEY_NOT_FOUND_MESSAGE)
      const outputDir = flags.output || './backlog-issues'

      const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}
      const client = new BacklogHttpClient({
        apiKey,
        domain,
        onRateLimitWait: () => this.log('レート制限を回避するため15秒間待機します...'),
      })

      // 出力ディレクトリの作成
      await ensureDirectory(outputDir)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(client, projectIdOrKey)
      this.log(`プロジェクトID: ${projectId} を使用します`)

      // 設定ファイルを保存
      await updateSettings(outputDir, {
        apiKey,
        domain,
        folderType: FolderType.ISSUE,
        issueKeyFileName,
        issueKeyFolder,
        outputDir,
        projectIdOrKey,
      })

      // 課題の取得と保存
      await exportIssues(client, logger, {
        count: maxCount,
        domain,
        issueKeyFileName,
        issueKeyFolder,
        outputDir,
        projectId,
        statusId,
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
