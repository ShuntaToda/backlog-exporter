import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'

import {downloadWikis} from '../../utils/backlog-api.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class Wiki extends Command {
  static description = t('commands.wiki.description')
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
${t('commands.wiki.examples.saveWiki')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-project
${t('commands.wiki.examples.outputDir')}
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
    const {flags} = await this.parse(Wiki)

    try {
      const {domain, projectIdOrKey} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputDir = flags.output || './wiki'

      // 出力ディレクトリの作成
      await createOutputDirectory(outputDir)

      // 設定ファイルを保存
      await updateSettings(outputDir, {
        apiKey,
        domain,
        folderType: FolderType.WIKI,
        outputDir,
        projectIdOrKey,
      })

      // Wikiの取得と保存
      await downloadWikis(this, {
        apiKey,
        domain,
        outputDir,
        projectIdOrKey,
      })

      // 最終更新日時を更新
      await updateSettings(outputDir, {
        lastUpdated: new Date().toISOString(),
      })

      this.log(t('commands.wiki.messages.completed'))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.wiki.messages.fetchFailed', {errorMessage}))
    }
  }
}
