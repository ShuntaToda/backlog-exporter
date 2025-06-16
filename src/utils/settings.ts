import * as fs from 'node:fs/promises'
import {join} from 'node:path'

/**
 * フォルダタイプの定義
 */
export enum FolderType {
  DOCUMENT = 'document',
  ISSUE = 'issue',
  WIKI = 'wiki',
}

/**
 * 設定ファイルの型定義
 */
export interface Settings {
  apiKey?: string
  domain?: string
  folderType?: FolderType
  lastUpdated?: string
  outputDir?: string
  projectIdOrKey?: string
}

/**
 * 設定ファイルのパスを取得する
 * @param directory 設定ファイルを保存するディレクトリ
 * @returns 設定ファイルのパス
 */
export function getSettingsFilePath(directory: string): string {
  return join(directory, 'backlog-settings.json')
}

/**
 * 設定ファイルを読み込む
 * @param directory 設定ファイルが保存されているディレクトリ
 * @returns 設定情報
 */
export async function loadSettings(directory: string): Promise<Settings> {
  const settingsPath = getSettingsFilePath(directory)

  try {
    const data = await fs.readFile(settingsPath, 'utf8')
    return JSON.parse(data) as Settings
  } catch {
    // ファイルが存在しない場合や読み込みエラーの場合は空のオブジェクトを返す
    return {}
  }
}

/**
 * 設定ファイルを保存する
 * @param directory 設定ファイルを保存するディレクトリ
 * @param settings 保存する設定情報
 */
export async function saveSettings(directory: string, settings: Settings): Promise<void> {
  const settingsPath = getSettingsFilePath(directory)

  // ディレクトリが存在しない場合は作成
  await fs.mkdir(directory, {recursive: true})

  // 設定ファイルを保存
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

/**
 * 設定ファイルを更新する
 * @param directory 設定ファイルを保存するディレクトリ
 * @param newSettings 更新する設定情報
 */
export async function updateSettings(directory: string, newSettings: Partial<Settings>): Promise<Settings> {
  // 既存の設定を読み込む
  const currentSettings = await loadSettings(directory)

  // 新しい設定で更新（apiKeyは除外）
  const {apiKey, ...settingsToSave} = newSettings
  const updatedSettings = {...currentSettings, ...settingsToSave}

  // 更新した設定を保存
  await saveSettings(directory, updatedSettings)

  // apiKeyは戻り値には含める
  return {...updatedSettings, apiKey}
}
