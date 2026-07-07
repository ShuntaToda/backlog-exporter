import {Command, Flags} from '@oclif/core'

import {createBacklogRepositories} from '../../composition/backlog-repositories.js'
import {FolderType} from '../../modules/settings/domain/settings.js'
import {updateSettings} from '../../modules/settings/repository/settings-store.js'
import {exportWikis} from '../../modules/wiki/use-case/export-wikis.js'
import {API_KEY_NOT_FOUND_MESSAGE, loadDotenv, resolveApiKey} from '../../shared/config/env.js'
import {ensureDirectory} from '../../shared/storage/markdown-store.js'

// .envファイルを読み込む
loadDotenv()

export default class Wiki extends Command {
  static description = 'Backlogから Wiki を取得してMarkdownファイルとして保存する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
Wikiをダウンロードする
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-project
指定したディレクトリにWikiを保存する
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
    const {flags} = await this.parse(Wiki)

    try {
      const {domain, projectIdOrKey} = flags
      const apiKey =
        resolveApiKey(flags.apiKey, () => this.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します')) ??
        this.error(API_KEY_NOT_FOUND_MESSAGE)
      const outputDir = flags.output || './wiki'

      const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}
      const {wikiRepository} = createBacklogRepositories({
        apiKey,
        domain,
        onRateLimitWait: () => this.log('レート制限を回避するため15秒間待機します...'),
      })

      // 出力ディレクトリの作成
      await ensureDirectory(outputDir)

      // 設定ファイルを保存
      await updateSettings(outputDir, {
        apiKey,
        domain,
        folderType: FolderType.WIKI,
        outputDir,
        projectIdOrKey,
      })

      // Wikiの取得と保存
      await exportWikis(
        {logger, wikiRepository},
        {
          domain,
          outputDir,
          projectIdOrKey,
        },
      )

      // 最終更新日時を更新
      await updateSettings(outputDir, {
        lastUpdated: new Date().toISOString(),
      })

      this.log('Wikiの取得が完了しました！')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`Wikiの取得に失敗しました: ${errorMessage}`)
    }
  }
}
