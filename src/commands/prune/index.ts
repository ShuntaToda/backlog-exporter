import {Args, Command, Flags} from '@oclif/core'
import * as dotenv from 'dotenv'
import {access, readdir} from 'node:fs/promises'
import {join} from 'node:path'
import process from 'node:process'

import {pruneDocuments, pruneWikis} from '../../utils/backlog-api.js'
import {validateAndGetProjectId} from '../../utils/backlog.js'
import {getApiKey} from '../../utils/common.js'
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
      description: '対象ディレクトリ（設定ファイルが保存されている場所）',
      required: false,
    }),
  }
  static description =
    'Backlog上で削除・移動されたドキュメント・Wikiのローカルファイルを削除し、Backlogと同じ状態に揃える'
  static examples = [
    `<%= config.bin %> <%= command.id %>
カレントディレクトリ配下の設定ファイルを探索し、Backlog上に存在しないドキュメントファイルを削除する
`,
    `<%= config.bin %> <%= command.id %> ./backlog-documents
指定したディレクトリを対象にする
`,
    `<%= config.bin %> <%= command.id %> --force
確認プロンプトをスキップして削除する
`,
  ]
  static flags = {
    apiKey: Flags.string({
      description: 'Backlog API key (環境変数 BACKLOG_API_KEY からも自動読み取り可能)',
      required: false,
    }),
    domain: Flags.string({
      description: 'Backlog domain (e.g. example.backlog.jp)',
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: '確認プロンプトをスキップする',
      required: false,
    }),
    projectIdOrKey: Flags.string({
      description: 'Backlog project ID or key',
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
      this.error(`pruneに失敗しました: ${errorMessage}`)
    }
  }

  // 確認プロンプトの表示
  private async confirmPrune(targetDir: string): Promise<boolean> {
    // 非対話環境（CI・パイプ入力など）では 'data' イベントが発火せず永久に待機してしまうため、
    // プロンプトを出さずにエラーとして終了する
    if (!process.stdin.isTTY) {
      this.error(
        '対話的な確認ができない環境のため中止しました（標準入力が端末ではありません）。--force フラグを付けると確認をスキップして実行できます。',
      )
    }

    this.log('以下のディレクトリで、Backlog上に存在しないドキュメント・Wiki（.mdファイル）を削除します:')
    this.log(`- ディレクトリ: ${targetDir}`)
    this.log('削除を実行しますか？ (y/n)')

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
      this.log('pruneをキャンセルしました')
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
      this.warn(`ディレクトリの読み取りに失敗しました: ${targetDir}`)
    }
  }

  // 指定されたディレクトリのpruneを実行する
  private async pruneDirectory(targetDir: string, flags: PruneFlags): Promise<void> {
    const settings = await loadSettings(targetDir)

    // pruneはドキュメント・Wikiが対象。それ以外（課題など）のフォルダはスキップする
    if (settings.folderType !== FolderType.DOCUMENT && settings.folderType !== FolderType.WIKI) {
      // 古いバージョンで作成された設定ファイルには folderType がないため、無言でスキップせず理由を伝える
      if (!settings.folderType) {
        this.warn(
          `${targetDir}: 設定ファイルに folderType がないためスキップします（update コマンドを実行すると保存されます）`,
        )
      }

      return
    }

    const domain = flags.domain || settings.domain
    const projectIdOrKey = flags.projectIdOrKey || settings.projectIdOrKey

    if (!domain) {
      this.warn(`${targetDir}: ドメインが指定されていません。スキップします。`)
      return
    }

    if (!projectIdOrKey) {
      this.warn(`${targetDir}: プロジェクトID/キーが指定されていません。スキップします。`)
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

    this.log(`${targetDir} のpruneが完了しました！`)
  }
}
