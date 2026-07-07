import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'

import {downloadIssues} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class Issue extends Command {
  static description = t('commands.issue.description')
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
${t('commands.issue.examples.saveIssues')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-issues
${t('commands.issue.examples.outputDir')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --statusId 1,2,3
${t('commands.issue.examples.statusId')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --maxCount 10000
${t('commands.issue.examples.maxCount')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName
${t('commands.issue.examples.issueKeyFileName')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFolder
${t('commands.issue.examples.issueKeyFolder')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName --issueKeyFolder
${t('commands.issue.examples.issueKeyFolderAndFileName')}
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
    issueKeyFileName: Flags.boolean({
      description: t('common.flags.issueKeyFileName'),
      required: false,
    }),
    issueKeyFolder: Flags.boolean({
      description: t('common.flags.issueKeyFolder'),
      required: false,
    }),
    maxCount: Flags.integer({
      char: 'm',
      default: 5000,
      description: t('common.flags.maxCount'),
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
    statusId: Flags.string({
      description: t('common.flags.statusId'),
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Issue)

    try {
      const {domain, issueKeyFileName, issueKeyFolder, maxCount, projectIdOrKey, statusId} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputDir = flags.output || './backlog-issues'

      // 出力ディレクトリの作成
      await createOutputDirectory(outputDir)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      this.log(t('common.messages.usingProjectId', {projectId}))

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
      await downloadIssues(this, {
        apiKey,
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

      this.log(t('commands.issue.messages.completed'))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.issue.messages.fetchFailed', {errorMessage}))
    }
  }
}
