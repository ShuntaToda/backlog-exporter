import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'

import {downloadDocuments} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class Document extends Command {
  static description = t('commands.document.description')
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
${t('commands.document.examples.saveDocuments')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-documents
${t('commands.document.examples.outputDir')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --keyword 仕様書
${t('commands.document.examples.keyword')}
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: t('common.flags.apiKey'),
      required: false,
    }),
    domain: Flags.string({
      description: t('common.flags.domain'),
      required: true,
    }),
    keyword: Flags.string({
      description: t('common.flags.keyword'),
      required: false,
    }),
    output: Flags.string({
      char: 'o',
      description: t('common.flags.output'),
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: t('common.flags.projectIdOrKey'),
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Document)

    try {
      const {domain, keyword, projectIdOrKey} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputDir = flags.output || './backlog-documents'

      // 出力ディレクトリの作成
      await createOutputDirectory(outputDir)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      this.log(t('common.messages.usingProjectId', {projectId}))

      // 設定ファイルを保存
      await updateSettings(outputDir, {
        apiKey,
        domain,
        folderType: FolderType.DOCUMENT,
        outputDir,
        projectIdOrKey,
      })

      // ドキュメントの取得と保存
      await downloadDocuments(this, {
        apiKey,
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

      this.log(t('commands.document.messages.completed'))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.document.messages.fetchFailed', {errorMessage}))
    }
  }
}
