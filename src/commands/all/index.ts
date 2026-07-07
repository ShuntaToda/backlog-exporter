import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'
import path from 'node:path'

import {downloadDocuments, downloadIssues, downloadWikis} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class All extends Command {
  static description = t('commands.all.description')
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
${t('commands.all.examples.saveAll')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-project
${t('commands.all.examples.outputDir')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --only issues,wiki
${t('commands.all.examples.onlyIssuesAndWiki')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --exclude documents
${t('commands.all.examples.excludeDocuments')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --maxCount 1000
${t('commands.all.examples.maxCount')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName
${t('commands.all.examples.issueKeyFileName')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFolder
${t('commands.all.examples.issueKeyFolder')}
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName --issueKeyFolder
${t('commands.all.examples.issueKeyFolderAndFileName')}
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
    exclude: Flags.string({
      description: t('common.flags.exclude'),
      required: false,
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
    only: Flags.string({
      description: t('common.flags.only'),
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
    const {flags} = await this.parse(All)

    try {
      const {domain, exclude, issueKeyFileName, issueKeyFolder, maxCount, only, projectIdOrKey} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputRoot = flags.output || './backlog-data'

      // Check for conflicting flags
      if (only && exclude) {
        this.error(t('commands.all.messages.onlyExcludeConflict'))
      }

      // Determine targets based on flags
      let targets: string[]
      if (only) {
        targets = only.split(',')
      } else if (exclude) {
        const excludeTargets = exclude.split(',')
        const allTargets = ['issues', 'wiki', 'documents']
        targets = allTargets.filter((target) => !excludeTargets.includes(target))
      } else {
        targets = ['issues', 'wiki', 'documents']
      }

      // Validate targets
      const validTargets = ['issues', 'wiki', 'documents']
      const inputTargets = only ? only.split(',') : exclude ? exclude.split(',') : []
      for (const target of inputTargets) {
        if (!validTargets.includes(target)) {
          this.error(
            t('commands.all.messages.invalidTarget', {
              availableTargets: validTargets.join(', '),
              target,
            }),
          )
        }
      }

      // Check if any targets remain after exclusion
      if (targets.length === 0) {
        this.error(t('commands.all.messages.noTargetsAfterExclusion'))
      }

      // 出力ディレクトリの作成
      await createOutputDirectory(outputRoot)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      this.log(t('common.messages.usingProjectId', {projectId}))

      if (targets.includes('issues')) {
        // 課題の出力ディレクトリ
        const issueOutput = path.join(outputRoot, 'issues')
        await createOutputDirectory(issueOutput)

        // 課題フォルダに設定ファイルを保存
        await updateSettings(issueOutput, {
          apiKey,
          domain,
          folderType: FolderType.ISSUE,
          issueKeyFileName,
          issueKeyFolder,
          outputDir: issueOutput,
          projectIdOrKey,
        })

        // 課題の取得と保存
        this.log(t('commands.all.messages.issuesFetchStart'))
        await downloadIssues(this, {
          apiKey,
          count: maxCount,
          domain,
          issueKeyFileName,
          issueKeyFolder,
          outputDir: issueOutput,
          projectId,
        })

        // 課題フォルダの最終更新日時を更新
        await updateSettings(issueOutput, {
          lastUpdated: new Date().toISOString(),
        })
        this.log(t('commands.all.messages.issuesCompleted'))
      }

      if (targets.includes('wiki')) {
        // Wikiの出力ディレクトリ
        const wikiOutput = path.join(outputRoot, 'wiki')
        await createOutputDirectory(wikiOutput)

        // Wikiフォルダに設定ファイルを保存
        await updateSettings(wikiOutput, {
          apiKey,
          domain,
          folderType: FolderType.WIKI,
          outputDir: wikiOutput,
          projectIdOrKey,
        })

        // Wikiの取得と保存
        this.log(t('commands.all.messages.wikiFetchStart'))
        await downloadWikis(this, {
          apiKey,
          domain,
          outputDir: wikiOutput,
          projectIdOrKey,
        })

        // Wikiフォルダの最終更新日時を更新
        await updateSettings(wikiOutput, {
          lastUpdated: new Date().toISOString(),
        })
        this.log(t('commands.all.messages.wikiCompleted'))
      }

      if (targets.includes('documents')) {
        // ドキュメントの出力ディレクトリ
        const documentOutput = path.join(outputRoot, 'documents')
        await createOutputDirectory(documentOutput)

        // ドキュメントフォルダに設定ファイルを保存
        await updateSettings(documentOutput, {
          apiKey,
          domain,
          folderType: FolderType.DOCUMENT,
          outputDir: documentOutput,
          projectIdOrKey,
        })

        // ドキュメントの取得と保存
        this.log(t('commands.all.messages.documentsFetchStart'))
        await downloadDocuments(this, {
          apiKey,
          domain,
          outputDir: documentOutput,
          projectId,
          projectIdOrKey,
        })

        // ドキュメントフォルダの最終更新日時を更新
        await updateSettings(documentOutput, {
          lastUpdated: new Date().toISOString(),
        })
        this.log(t('commands.all.messages.documentsCompleted'))
      }

      this.log(t('commands.all.messages.allCompleted'))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.all.messages.fetchFailed', {errorMessage}))
    }
  }
}
