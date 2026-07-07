import {Args, Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'
import {access, readdir} from 'node:fs/promises'
import {join} from 'node:path'

import {downloadDocuments, downloadIssues, downloadWikis} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {createOutputDirectory, getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, getSettingsFilePath, loadSettings, updateSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

// フラグの型定義
interface UpdateFlags {
  apiKey?: string
  documentId?: string
  documentsOnly?: boolean
  domain?: string
  force?: boolean
  issueIdOrKey?: string
  issueKeyFileName?: boolean
  issueKeyFolder?: boolean
  issuesOnly?: boolean
  projectIdOrKey?: string
  wikiId?: string
  wikisOnly?: boolean
}

export default class Update extends Command {
  static args = {
    directory: Args.string({
      description: t('commands.update.args.directory'),
      required: false,
    }),
  }
  static description = t('commands.update.description')
  static examples = [
    `<%= config.bin %> <%= command.id %>
${t('commands.update.examples.currentDir')}
`,
    `<%= config.bin %> <%= command.id %> --force
${t('commands.update.examples.force')}
`,
    `<%= config.bin %> <%= command.id %> --apiKey YOUR_API_KEY --domain example.backlog.jp --projectIdOrKey PROJECT_KEY
${t('commands.update.examples.specifyParams')}
`,
    `<%= config.bin %> <%= command.id %> ./my-project
${t('commands.update.examples.specifyDir')}
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFileName
${t('commands.update.examples.issueKeyFileName')}
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFolder
${t('commands.update.examples.issueKeyFolder')}
`,
    `<%= config.bin %> <%= command.id %> --issueKeyFileName --issueKeyFolder
${t('commands.update.examples.issueKeyFolderAndFileName')}
`,
    `<%= config.bin %> <%= command.id %> --issueIdOrKey PROJECT-1,PROJECT-2
指定した課題（IDまたはキー）のみを再取得する（全件差分更新は行わない）
`,
    `<%= config.bin %> <%= command.id %> --wikiId 12345,12346
指定したWiki（ID）のみを再取得する（全件差分更新は行わない）
`,
    `<%= config.bin %> <%= command.id %> --documentId abc123,def456
指定したドキュメント（ID）のみを再取得する（全件差分更新は行わない）
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: t('common.flags.apiKey'),
      required: false,
    }),
    documentId: Flags.string({
      description: t('commands.update.flags.documentId'),
      required: false,
    }),
    documentsOnly: Flags.boolean({
      description: t('common.flags.documentsOnly'),
      required: false,
    }),
    domain: Flags.string({
      description: t('common.flags.domain'),
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: t('common.flags.force'),
      required: false,
    }),
    issueIdOrKey: Flags.string({
      description: t('commands.update.flags.issueIdOrKey'),
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
    issuesOnly: Flags.boolean({
      description: t('common.flags.issuesOnly'),
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: t('common.flags.projectIdOrKey'),
      required: false,
    }),
    wikiId: Flags.string({
      description: t('commands.update.flags.wikiId'),
      required: false,
    }),
    wikisOnly: Flags.boolean({
      description: t('common.flags.wikisOnly'),
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Update)

    // 更新対象のディレクトリを決定（指定がなければカレントディレクトリ）
    const targetDir = args.directory || process.cwd()

    try {
      // 設定ファイルを探索して更新を実行
      await this.findAndUpdateSettings(targetDir, flags as UpdateFlags)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.update.messages.updateFailed', {errorMessage}))
    }
  }

  // 確認プロンプトの表示
  private async confirmUpdate(options: {
    domain: string
    folderType?: FolderType
    force: boolean
    projectIdOrKey: string
    targetDir: string
    updateDocuments: boolean
    updateIssues: boolean
    updateWikis: boolean
  }): Promise<boolean> {
    if (options.force) return true

    this.log(t('commands.update.messages.confirmSettings'))
    this.log(t('commands.update.messages.settingDirectory', {targetDir: options.targetDir}))
    this.log(t('commands.update.messages.settingDomain', {domain: options.domain}))
    this.log(t('commands.update.messages.settingProject', {projectIdOrKey: options.projectIdOrKey}))

    if (options.folderType) {
      this.log(t('commands.update.messages.folderType', {folderType: options.folderType}))
    }

    const updateTargets = []
    if (options.updateIssues) updateTargets.push(t('commands.update.messages.targetIssues'))
    if (options.updateWikis) updateTargets.push(t('commands.update.messages.targetWiki'))
    if (options.updateDocuments) updateTargets.push(t('commands.update.messages.targetDocuments'))

    this.log(t('commands.update.messages.settingTargets', {targets: updateTargets.join('・')}))

    // 確認プロンプトを表示
    this.log(t('commands.update.messages.confirmPrompt'))
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const response = await new Promise<boolean>((resolve) => {
      process.stdin.once('data', (data) => {
        const input = data.toString().trim().toLowerCase()
        resolve(input === 'y' || input === 'yes')
        process.stdin.pause()
      })
    })

    if (!response) {
      this.log(t('commands.update.messages.cancelled'))
    }

    return response
  }

  // 更新対象の決定
  private determineUpdateTargets(
    folderType: FolderType | undefined,
    documentsOnly: boolean | undefined,
    issuesOnly: boolean | undefined,
    wikisOnly: boolean | undefined,
  ): {
    updateDocuments: boolean
    updateIssues: boolean
    updateWikis: boolean
  } {
    let updateIssues = !wikisOnly && !documentsOnly
    let updateWikis = !issuesOnly && !documentsOnly
    let updateDocuments = !issuesOnly && !wikisOnly

    // フォルダタイプに応じて更新対象を決定
    switch (folderType) {
      case FolderType.DOCUMENT: {
        updateIssues = false
        updateWikis = false
        updateDocuments = true
        break
      }

      case FolderType.ISSUE: {
        updateIssues = true
        updateWikis = false
        updateDocuments = false
        break
      }

      case FolderType.WIKI: {
        updateIssues = false
        updateWikis = true
        updateDocuments = false
        break
      }
    }

    return {updateDocuments, updateIssues, updateWikis}
  }

  // 設定ファイルを探索して更新を実行
  private async findAndUpdateSettings(targetDir: string, flags: UpdateFlags): Promise<void> {
    // 現在のディレクトリに設定ファイルがあるか確認
    const settingsPath = getSettingsFilePath(targetDir)
    let hasSettings = false

    try {
      await access(settingsPath)
      hasSettings = true
    } catch {
      // 設定ファイルが存在しない場合は何もしない
    }

    if (hasSettings) {
      // 設定ファイルが存在する場合は更新を実行
      await this.updateDirectory(targetDir, flags)
    }

    // サブディレクトリを探索
    try {
      const entries = await readdir(targetDir, {withFileTypes: true})

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = join(targetDir, entry.name)
          // eslint-disable-next-line no-await-in-loop
          await this.findAndUpdateSettings(subDir, flags)
        }
      }
    } catch {
      this.warn(t('commands.update.messages.directoryReadFailed', {targetDir}))
    }
  }

  // 指定されたディレクトリの更新を実行
  private async updateDirectory(targetDir: string, flags: UpdateFlags): Promise<void> {
    // 設定ファイルを読み込む
    const settings = await loadSettings(targetDir)

    // コマンドライン引数と設定ファイルを組み合わせて使用する値を決定
    const domain = flags.domain || settings.domain
    const projectIdOrKey = flags.projectIdOrKey || settings.projectIdOrKey
    const {folderType} = settings
    const {documentsOnly, force, issuesOnly, wikisOnly} = flags

    // 設定ファイルからオプションを読み込み、コマンドライン引数で上書き
    const issueKeyFileName = flags.issueKeyFileName ?? settings.issueKeyFileName ?? false
    const issueKeyFolder = flags.issueKeyFolder ?? settings.issueKeyFolder ?? false

    // 課題・Wiki・ドキュメントのID指定をカンマ区切りでパース（指定時は該当項目のみを再取得する）
    const parseIds = (value: string | undefined): string[] | undefined => {
      if (!value) return undefined
      const ids = value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      return ids.length > 0 ? ids : undefined
    }

    const issueIdOrKeys = parseIds(flags.issueIdOrKey)
    const wikiIds = parseIds(flags.wikiId)
    const documentIds = parseIds(flags.documentId)

    // 必須パラメータの検証
    if (!domain) {
      this.warn(t('commands.update.messages.domainMissing', {targetDir}))
      return
    }

    if (!projectIdOrKey) {
      this.warn(t('commands.update.messages.projectMissing', {targetDir}))
      return
    }

    // APIキーの検証
    let apiKey: string
    try {
      apiKey = flags.apiKey || settings.apiKey || getApiKey(this)
    } catch {
      this.warn(t('commands.update.messages.apiKeyMissing', {targetDir}))
      return
    }

    // 更新対象の決定
    const targets = this.determineUpdateTargets(folderType, documentsOnly, issuesOnly, wikisOnly)

    // いずれかのID指定がある場合は「指定した項目のみ再取得」モードとし、
    // ID指定のない種別は更新対象から外す（例: --wikiId のみ指定時は課題・ドキュメントを更新しない）
    const hasTargetedFetch = Boolean(issueIdOrKeys || wikiIds || documentIds)
    if (hasTargetedFetch) {
      if (!issueIdOrKeys) targets.updateIssues = false
      if (!wikiIds) targets.updateWikis = false
      if (!documentIds) targets.updateDocuments = false
    }

    const {updateDocuments, updateIssues, updateWikis} = targets

    // 更新前の確認
    const confirmed = await this.confirmUpdate({
      domain,
      folderType,
      force: force || false,
      projectIdOrKey,
      targetDir,
      updateDocuments,
      updateIssues,
      updateWikis,
    })
    if (!confirmed) return

    // 出力ディレクトリの作成
    await createOutputDirectory(targetDir)

    // プロジェクトキーからプロジェクトIDを取得
    const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
    this.log(t('common.messages.usingProjectId', {projectId}))

    // 課題の更新
    if (updateIssues) {
      await this.updateIssues({
        apiKey,
        domain,
        issueIdOrKeys,
        issueKeyFileName,
        issueKeyFolder,
        projectId,
        projectIdOrKey,
        targetDir,
      })
    }

    // Wikiの更新
    if (updateWikis) {
      await this.updateWikis({
        apiKey,
        domain,
        projectIdOrKey,
        targetDir,
        wikiIds,
      })
    }

    // ドキュメントの更新
    if (updateDocuments) {
      await this.updateDocuments({
        apiKey,
        documentIds,
        domain,
        projectId,
        projectIdOrKey,
        targetDir,
      })
    }

    this.log(t('commands.update.messages.updateCompleted', {targetDir}))
  }

  // ドキュメントの更新
  private async updateDocuments(options: {
    apiKey: string
    documentIds?: string[]
    domain: string
    projectId: number
    projectIdOrKey: string
    targetDir: string
  }): Promise<void> {
    this.log(t('commands.update.messages.documentsStart'))

    // 設定ファイルから前回の更新日時を取得
    // ドキュメントID指定時は全件差分更新ではなく該当ドキュメントのみを取得するため、lastUpdatedによる絞り込みは行わない
    const {lastUpdated} = await loadSettings(options.targetDir)

    await downloadDocuments(this, {
      apiKey: options.apiKey,
      documentIds: options.documentIds,
      domain: options.domain,
      lastUpdated: options.documentIds ? undefined : lastUpdated,
      outputDir: options.targetDir,
      projectId: options.projectId,
      projectIdOrKey: options.projectIdOrKey,
    })

    // ドキュメントID指定時は全件取得ではないため、最終更新日時（lastUpdated）は更新しない
    if (options.documentIds) {
      this.log(t('commands.update.messages.documentsCompleted'))
      return
    }

    // 設定ファイルを更新
    await updateSettings(options.targetDir, {
      apiKey: options.apiKey,
      domain: options.domain,
      folderType: FolderType.DOCUMENT,
      lastUpdated: new Date().toISOString(),
      outputDir: options.targetDir,
      projectIdOrKey: options.projectIdOrKey,
    })

    this.log(t('commands.update.messages.documentsCompleted'))
  }

  // 課題の更新
  private async updateIssues(options: {
    apiKey: string
    domain: string
    issueIdOrKeys?: string[]
    issueKeyFileName?: boolean
    issueKeyFolder?: boolean
    projectId: number
    projectIdOrKey: string
    targetDir: string
  }): Promise<void> {
    this.log(t('commands.update.messages.issuesStart'))

    // 設定ファイルから前回の更新日時を取得
    // 課題ID・キー指定時は全件差分更新ではなく該当課題のみを取得するため、lastUpdatedによる絞り込みは行わない
    const {lastUpdated} = await loadSettings(options.targetDir)

    await downloadIssues(this, {
      apiKey: options.apiKey,
      count: 100,
      domain: options.domain,
      issueIdOrKeys: options.issueIdOrKeys,
      issueKeyFileName: options.issueKeyFileName,
      issueKeyFolder: options.issueKeyFolder,
      lastUpdated: options.issueIdOrKeys ? undefined : lastUpdated,
      outputDir: options.targetDir,
      projectId: options.projectId,
    })

    // 課題ID・キー指定時は全件取得ではないため、最終更新日時（lastUpdated）は更新しない
    // （次回の全件差分更新に影響を与えないようにするため）
    if (options.issueIdOrKeys) {
      this.log(t('commands.update.messages.issuesCompleted'))
      return
    }

    // 設定ファイルを更新
    await updateSettings(options.targetDir, {
      apiKey: options.apiKey,
      domain: options.domain,
      folderType: FolderType.ISSUE,
      lastUpdated: new Date().toISOString(),
      outputDir: options.targetDir,
      projectIdOrKey: options.projectIdOrKey,
    })

    this.log(t('commands.update.messages.issuesCompleted'))
  }

  // Wikiの更新
  private async updateWikis(options: {
    apiKey: string
    domain: string
    projectIdOrKey: string
    targetDir: string
    wikiIds?: string[]
  }): Promise<void> {
    this.log(t('commands.update.messages.wikiStart'))

    // 設定ファイルから前回の更新日時を取得
    // Wiki ID指定時は全件差分更新ではなく該当Wikiのみを取得するため、lastUpdatedによる絞り込みは行わない
    const {lastUpdated} = await loadSettings(options.targetDir)

    await downloadWikis(this, {
      apiKey: options.apiKey,
      domain: options.domain,
      lastUpdated: options.wikiIds ? undefined : lastUpdated,
      outputDir: options.targetDir,
      projectIdOrKey: options.projectIdOrKey,
      wikiIds: options.wikiIds,
    })

    // Wiki ID指定時は全件取得ではないため、最終更新日時（lastUpdated）は更新しない
    if (options.wikiIds) {
      this.log(t('commands.update.messages.wikiCompleted'))
      return
    }

    // 設定ファイルを更新
    await updateSettings(options.targetDir, {
      apiKey: options.apiKey,
      domain: options.domain,
      folderType: FolderType.WIKI,
      lastUpdated: new Date().toISOString(),
      outputDir: options.targetDir,
      projectIdOrKey: options.projectIdOrKey,
    })

    this.log(t('commands.update.messages.wikiCompleted'))
  }
}
