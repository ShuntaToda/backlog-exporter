import i18next from 'i18next'
import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const localesDir = join(__dirname, '..', 'locales')

/**
 * 翻訳ファイルを同期的に読み込む
 */
function loadTranslation(locale: string): Record<string, unknown> {
  const filePath = join(localesDir, `${locale}.json`)
  const content = readFileSync(filePath, 'utf8')
  return JSON.parse(content) as Record<string, unknown>
}

/**
 * localesディレクトリから全翻訳リソースを動的に読み込む
 */
function loadAllTranslations(): Record<string, {translation: Record<string, unknown>}> {
  const files = readdirSync(localesDir).filter(f => f.endsWith('.json'))
  const resources: Record<string, {translation: Record<string, unknown>}> = {}
  for (const file of files) {
    const locale = file.replace('.json', '')
    resources[locale] = {translation: loadTranslation(locale)}
  }

  return resources
}

/**
 * 環境変数からロケールを検出する
 *
 * LC_ALL / LC_MESSAGES / LANG のいずれも未設定の場合（Windowsのcmd/PowerShellは
 * 通常LANGを設定しない）は、i18n導入前の既存動作を維持するため日本語にフォールバックする。
 * 環境変数が設定されていて未対応のロケールだった場合のみ英語にフォールバックする。
 */
export function detectLocale(supportedLocales: string[], env: NodeJS.ProcessEnv = process.env): string {
  const langEnv = env.LC_ALL || env.LC_MESSAGES || env.LANG
  if (!langEnv) {
    return 'ja'
  }

  const lang = langEnv.split(/[._-]/)[0]
  return supportedLocales.includes(lang) ? lang : 'en'
}

const resources = loadAllTranslations()
const locale = detectLocale(Object.keys(resources))

// eslint-disable-next-line import/no-named-as-default-member
i18next.init({
  fallbackLng: 'ja',
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  lng: locale,
  resources,
  showSupportNotice: false,
})

// eslint-disable-next-line import/no-named-as-default-member
export const t = i18next.t.bind(i18next)

// eslint-disable-next-line unicorn/prefer-export-from
export default i18next
