import i18next from 'i18next'
import {readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const localesDir = join(__dirname, '..', 'locales')

const FALLBACK_LOCALE = 'ja'

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
 */
function detectLocale(supportedLocales: string[]): string {
  const langEnv = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || ''
  const lang = langEnv.split(/[._]/)[0]
  return supportedLocales.includes(lang) ? lang : FALLBACK_LOCALE
}

const resources = loadAllTranslations()
const locale = detectLocale(Object.keys(resources))

// eslint-disable-next-line import/no-named-as-default-member
i18next.init({
  fallbackLng: FALLBACK_LOCALE,
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  lng: locale,
  resources,
})

// eslint-disable-next-line import/no-named-as-default-member
export const t = i18next.t.bind(i18next)

// eslint-disable-next-line unicorn/prefer-export-from
export default i18next
