import 'i18next'

import type ja from './locales/ja.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof ja
    }
  }
}
