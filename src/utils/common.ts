import {Command} from '@oclif/core'
import * as fs from 'node:fs/promises'

import {t} from './i18n.js'

/**
 * APIキーを取得する（優先順位: コマンドライン引数 > 環境変数）
 * @param command コマンドインスタンス
 * @param providedApiKey コマンドライン引数から提供されたAPIキー
 * @returns APIキー
 */
export function getApiKey(command: Command, providedApiKey?: string): string {
  // コマンドライン引数からのAPIキー
  if (providedApiKey) {
    return providedApiKey
  }

  // 環境変数からのAPIキー
  const envApiKey = process.env.BACKLOG_API_KEY
  if (envApiKey) {
    command.log(t('common.messages.apiKeyFromEnv'))
    return envApiKey
  }

  // APIキーが見つからない場合はエラー
  command.error(t('common.messages.apiKeyNotFound'))
  return '' // この行は実行されないが、TypeScriptのエラーを回避するために必要
}

/**
 * ファイル名に使用できない文字を置換する関数
 * @param name 元のファイル名
 * @returns サニタイズされたファイル名
 */
export function sanitizeFileName(name: string): string {
  return name
    .replaceAll(/[\\/:*?"<>|]/g, '_') // Windowsで使用できない文字を置換
    .replaceAll(/\s+/g, '_') // スペースをアンダースコアに置換
    .replaceAll('.', '_') // ドットを置換
    .slice(0, 200) // 長すぎるファイル名を防ぐために200文字に制限
}

/**
 * Wikiファイル名のサニタイズ（スラッシュはディレクトリ区切りとして使用するため残す）
 * @param name 元のWiki名
 * @returns サニタイズされたWikiファイル名
 */
export function sanitizeWikiFileName(name: string): string {
  const invalidChars = ['\\', ':', '*', '?', '"', '<', '>', '|']
  let sanitizedName = name
  for (const char of invalidChars) {
    sanitizedName = sanitizedName.replaceAll(char, '_')
  }

  return sanitizedName
}

/**
 * 出力ディレクトリを作成する
 * @param outputDir 出力ディレクトリパス
 */
export async function createOutputDirectory(outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, {recursive: true})
}
