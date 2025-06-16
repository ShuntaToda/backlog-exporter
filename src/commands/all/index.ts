import {Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'
import path from 'node:path'

import {downloadDocuments, downloadIssues, downloadWikis} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {FolderType, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

export default class All extends Command {
  static description = 'Backlogから課題・Wiki・ドキュメントを取得してMarkdownファイルとして保存する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
課題・Wiki・ドキュメントをMarkdownファイルとして保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-project
指定したディレクトリに課題・Wiki・ドキュメントを保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --maxCount 1000
最大1000件の課題を取得する（デフォルトは5000件）
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
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(All)

    try {
      const {domain, maxCount, projectIdOrKey} = flags
      const apiKey = flags.apiKey || getApiKey(this)
      const outputRoot = flags.output || './backlog-data'

      // 出力ディレクトリの作成
      await createOutputDirectory(outputRoot)

      // プロジェクトキーからプロジェクトIDを取得
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      this.log(`プロジェクトID: ${projectId} を使用します`)

      // 課題の出力ディレクトリ
      const issueOutput = path.join(outputRoot, 'issues')
      await createOutputDirectory(issueOutput)

      // Wikiの出力ディレクトリ
      const wikiOutput = path.join(outputRoot, 'wiki')
      await createOutputDirectory(wikiOutput)

      // ドキュメントの出力ディレクトリ
      const documentOutput = path.join(outputRoot, 'documents')
      await createOutputDirectory(documentOutput)

      // 課題フォルダに設定ファイルを保存
      await updateSettings(issueOutput, {
        apiKey,
        domain,
        folderType: FolderType.ISSUE,
        outputDir: issueOutput,
        projectIdOrKey,
      })

      // Wikiフォルダに設定ファイルを保存
      await updateSettings(wikiOutput, {
        apiKey,
        domain,
        folderType: FolderType.WIKI,
        outputDir: wikiOutput,
        projectIdOrKey,
      })

      // ドキュメントフォルダに設定ファイルを保存
      await updateSettings(documentOutput, {
        apiKey,
        domain,
        folderType: FolderType.DOCUMENT,
        outputDir: documentOutput,
        projectIdOrKey,
      })

      // 課題の取得と保存
      this.log('課題の取得を開始します...')
      await downloadIssues(this, {
        apiKey,
        count: maxCount,
        domain,
        outputDir: issueOutput,
        projectId,
      })

      // 課題フォルダの最終更新日時を更新
      await updateSettings(issueOutput, {
        lastUpdated: new Date().toISOString(),
      })
      this.log('課題の取得が完了しました')

      // Wikiの取得と保存
      this.log('Wikiの取得を開始します...')
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
      this.log('Wikiの取得が完了しました')

      // ドキュメントの取得と保存
      this.log('ドキュメントの取得を開始します...')
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
      this.log('ドキュメントの取得が完了しました')

      this.log('すべてのデータの取得が完了しました！')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`データの取得に失敗しました: ${errorMessage}`)
    }
  }
}
