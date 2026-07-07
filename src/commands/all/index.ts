import {Command, Flags} from '@oclif/core'

import {createBacklogRepositories} from '../../composition/backlog-repositories.js'
import {applyContentSelection, parseContentSelection} from '../../modules/all/domain/content-selection.js'
import {exportAll, ExportTarget} from '../../modules/all/use-case/export-all.js'
import {API_KEY_NOT_FOUND_MESSAGE, loadDotenv, resolveApiKey} from '../../shared/config/env.js'
import {isInteractiveStdin, readLine} from '../../shared/console/prompt.js'

// .envファイルを読み込む
loadDotenv()

const VALID_TARGETS: ExportTarget[] = ['issues', 'wiki', 'documents']

export default class All extends Command {
  static description = 'Backlogから課題・Wiki・ドキュメントを取得してMarkdownファイルとして保存する'
  static examples = [
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
課題・Wiki・ドキュメントをMarkdownファイルとして保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./my-project
指定したディレクトリに課題・Wiki・ドキュメントを保存する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --only issues,wiki
課題とWikiのみを取得する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --exclude documents
ドキュメント以外（課題とWiki）を取得する
`,
    `<%= config.bin %> <%= command.id %> --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --maxCount 1000
最大1000件の課題を取得する（デフォルトは5000件）
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
    exclude: Flags.string({
      description: "Exclude the specified types, separated by commas (e.g., 'documents,wiki')",
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
    maxCount: Flags.integer({
      char: 'm',
      default: 5000,
      description: '一度に取得する課題の最大数（デフォルト: 5000）',
      required: false,
    }),
    only: Flags.string({
      description: "Export only the specified types, separated by commas (e.g., 'issues,wiki')",
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
      const {domain, exclude, issueKeyFileName, issueKeyFolder, maxCount, only, projectIdOrKey} = flags
      const apiKey =
        resolveApiKey(flags.apiKey, () => this.log('環境変数 BACKLOG_API_KEY からAPIキーを使用します')) ??
        this.error(API_KEY_NOT_FOUND_MESSAGE)
      const outputRoot = flags.output || './backlog-data'

      let targets = this.determineTargets(only, exclude)

      // --only / --exclude 未指定の対話実行では、Wiki・ドキュメントのどちらを取得するか選択できるようにする
      if (!only && !exclude && isInteractiveStdin()) {
        targets = applyContentSelection(targets, await this.promptContentSelection())
      }

      this.log(`取得対象: ${targets.join(', ')}`)

      const logger = {log: (message: string) => this.log(message), warn: (message: string) => this.warn(message)}
      const repositories = createBacklogRepositories({
        apiKey,
        domain,
        onRateLimitWait: () => this.log('レート制限を回避するため15秒間待機します...'),
      })

      await exportAll(
        {...repositories, logger},
        {
          apiKey,
          domain,
          issueKeyFileName,
          issueKeyFolder,
          maxCount,
          outputRoot,
          projectIdOrKey,
          targets,
        },
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(`データの取得に失敗しました: ${errorMessage}`)
    }
  }

  private determineTargets(only: string | undefined, exclude: string | undefined): ExportTarget[] {
    if (only && exclude) {
      this.error('Cannot use both --only and --exclude flags together. Please use only one.')
    }

    // 指定された値の検証
    const inputTargets = only ? only.split(',') : exclude ? exclude.split(',') : []
    for (const target of inputTargets) {
      if (!(VALID_TARGETS as string[]).includes(target)) {
        this.error(`Invalid target '${target}'. Available targets are: ${VALID_TARGETS.join(', ')}`)
      }
    }

    let targets: ExportTarget[]
    if (only) {
      targets = only.split(',') as ExportTarget[]
    } else if (exclude) {
      const excludeTargets = exclude.split(',')
      targets = VALID_TARGETS.filter((target) => !excludeTargets.includes(target))
    } else {
      targets = [...VALID_TARGETS]
    }

    if (targets.length === 0) {
      this.error('No targets remaining after exclusion. Please specify valid targets to export.')
    }

    return targets
  }

  private async promptContentSelection() {
    this.log('BacklogのWikiとドキュメントのどちらを取得しますか？（BacklogはWikiからドキュメントへの移行を予定しています）')
    this.log('  [1] 両方（デフォルト）  [2] Wikiのみ  [3] ドキュメントのみ')
    return parseContentSelection(await readLine())
  }
}
