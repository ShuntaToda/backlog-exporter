import {Command, Flags} from '@oclif/core'

import {exportDocuments} from '../../modules/document/use-case/export-documents.js'
import {validateAndGetProjectId} from '../../modules/project/repository/project-api.js'
import {FolderType} from '../../modules/settings/domain/settings.js'
import {updateSettings} from '../../modules/settings/repository/settings-store.js'
import {BacklogHttpClient} from '../../shared/backlog/http-client.js'
import {API_KEY_NOT_FOUND_MESSAGE, loadDotenv, resolveApiKey} from '../../shared/config/env.js'
import {ensureDirectory} from '../../shared/storage/markdown-store.js'

// .envファイルを読み込む
loadDotenv()

export default class Document extends Command {
  static description = 'Backlogからドキュメントを取得してMarkdownファイルとして保存する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
ドキュメントをMarkdownファイルとして保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-documents
指定したディレクトリにドキュメントを保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --keyword 仕様書
キーワード「仕様書」を含むドキュメントのみを取得する
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
    keyword: Flags.string({
      description: '検索キーワード',
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
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Document)

    try {
      const {domain, keyword, projectIdOrKey} = flags
      const apiKey =
        resolveApiKey(flags.apiKey, () => this.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します')) ??
        this.error(API_KEY_NOT_FOUND_MESSAGE)
      const outputDir = flags.output || './backlog-documents'

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
        folderType: FolderType.DOCUMENT,
        outputDir,
        projectIdOrKey,
      })

      // ドキュメントの取得と保存
      await exportDocuments(client, logger, {
        domain,
        keyword,
        outputDir,
        projectId,
        projectIdOrKey,
      })

      // 最終更新日時を更新
      await updateSettings(outputDir, {
        lastUpdated: new Date().toISOString(),
      })

      this.log('ドキュメントの取得が完了しました！')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`ドキュメントの取得に失敗しました: ${errorMessage}`)
    }
  }
}
