import {Args, Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'
import {access, readdir} from 'node:fs/promises'
import {join} from 'node:path'
import process from 'node:process'

import {pruneDocuments, pruneWikis} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {getApiKey} from '../../utils/common.js'
import {t} from '../../utils/i18n.js'
import {FolderType, getSettingsFilePath, loadSettings} from '../../utils/settings.js'

// .envファイルを読み込む
dotenv.config()

// フラグの型定義
interface PruneFlags {
  apiKey?: string
  domain?: string
  force?: boolean
  projectIdOrKey?: string
}

export default class Prune extends Command {
  static args = {
    directory: Args.string({
      description: t('commands.prune.args.directory'),
      required: false,
    }),
  }
  static description = t('commands.prune.description')
  static examples = [
    `<%= config.bin %> <%= command.id %>
${t('commands.prune.examples.currentDir')}
`,
    `<%= config.bin %> <%= command.id %> ./backlog-documents
${t('commands.prune.examples.specifyDir')}
`,
    `<%= config.bin %> <%= command.id %> --force
${t('commands.prune.examples.force')}
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: t('common.flags.apiKey'),
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
    projectIdOrKey: Flags.string({
      description: t('common.flags.projectIdOrKey'),
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Prune)
    const targetDir = args.directory || process.cwd()

    try {
      await this.findAndPrune(targetDir, flags as PruneFlags)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.error(t('commands.prune.messages.failed', {errorMessage}))
    }
  }

  // 確認プロンプトの表示
  private async confirmPrune(targetDir: string): Promise<boolean> {
    // 非対話環境（CI・パイプ入力など）では 'data' イベントが発火せず永久に待機してしまうため、
    // プロンプトを出さずにエラーとして終了する
    if (!process.stdin.isTTY) {
      this.error(t('commands.prune.messages.nonInteractive'))
    }

    this.log(t('commands.prune.messages.confirmHeader'))
    this.log(t('commands.prune.messages.confirmDirectory', {dir: targetDir}))
    this.log(t('commands.prune.messages.confirmPrompt'))

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
      this.log(t('commands.prune.messages.cancelled'))
    }

    return response
  }

  // 設定ファイルを探索してpruneを実行する
  private async findAndPrune(targetDir: string, flags: PruneFlags): Promise<void> {
    const settingsPath = getSettingsFilePath(targetDir)
    let hasSettings = false

    try {
      await access(settingsPath)
      hasSettings = true
    } catch {
      // 設定ファイルが存在しない場合は何もしない
    }

    if (hasSettings) {
      await this.pruneDirectory(targetDir, flags)
    }

    // サブディレクトリを探索
    try {
      const entries = await readdir(targetDir, {withFileTypes: true})
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = join(targetDir, entry.name)
          // eslint-disable-next-line no-await-in-loop
          await this.findAndPrune(subDir, flags)
        }
      }
    } catch {
      this.warn(t('commands.prune.messages.directoryReadFailed', {dir: targetDir}))
    }
  }

  // 指定されたディレクトリのpruneを実行する
  private async pruneDirectory(targetDir: string, flags: PruneFlags): Promise<void> {
    const settings = await loadSettings(targetDir)

    // pruneはドキュメント・Wikiが対象。それ以外（課題など）のフォルダはスキップする
    if (settings.folderType !== FolderType.DOCUMENT && settings.folderType !== FolderType.WIKI) {
      // 古いバージョンで作成された設定ファイルには folderType がないため、無言でスキップせず理由を伝える
      if (!settings.folderType) {
        this.warn(t('commands.prune.messages.folderTypeMissing', {dir: targetDir}))
      }

      return
    }

    const domain = flags.domain || settings.domain
    const projectIdOrKey = flags.projectIdOrKey || settings.projectIdOrKey

    if (!domain) {
      this.warn(t('commands.prune.messages.domainMissing', {dir: targetDir}))
      return
    }

    if (!projectIdOrKey) {
      this.warn(t('commands.prune.messages.projectMissing', {dir: targetDir}))
      return
    }

    const apiKey = getApiKey(this, flags.apiKey || settings.apiKey)

    // 削除を伴うため確認する（--force でスキップ）
    if (!flags.force) {
      const confirmed = await this.confirmPrune(targetDir)
      if (!confirmed) {
        return
      }
    }

    if (settings.folderType === FolderType.WIKI) {
      await pruneWikis(this, {
        apiKey,
        domain,
        outputDir: targetDir,
        projectIdOrKey,
      })
    } else {
      const projectId = await validateAndGetProjectId(domain, projectIdOrKey, apiKey)
      await pruneDocuments(this, {
        apiKey,
        domain,
        outputDir: targetDir,
        projectId,
      })
    }

    this.log(t('commands.prune.messages.completed', {dir: targetDir}))
  }
}
