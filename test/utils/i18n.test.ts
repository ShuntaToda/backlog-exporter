import {expect} from 'chai'

import i18next, {detectLocale} from '../../src/utils/i18n.js'

describe('i18n', () => {
  describe('detectLocale（環境変数からのロケール検出）', () => {
    const supported = ['ja', 'en']

    it('LANG=ja_JP.UTF-8 のとき ja を返すこと', () => {
      expect(detectLocale(supported, {LANG: 'ja_JP.UTF-8'})).to.equal('ja')
    })

    it('LANG=en_US.UTF-8 のとき en を返すこと', () => {
      expect(detectLocale(supported, {LANG: 'en_US.UTF-8'})).to.equal('en')
    })

    it('LC_ALL が LANG より優先されること', () => {
      expect(detectLocale(supported, {LANG: 'ja_JP.UTF-8', LC_ALL: 'en_US.UTF-8'})).to.equal('en')
    })

    it('未対応のロケールのとき en にフォールバックすること', () => {
      expect(detectLocale(supported, {LANG: 'fr_FR.UTF-8'})).to.equal('en')
    })

    it('環境変数がすべて未設定のとき、i18n導入前の既存動作を維持するため ja を返すこと', () => {
      expect(detectLocale(supported, {})).to.equal('ja')
    })
  })

  describe('翻訳リソースの解決', () => {
    it('en ロケールで英語メッセージを返すこと', () => {
      const fixedT = i18next.getFixedT('en')
      expect(fixedT('commands.prune.messages.cancelled')).to.equal('Prune cancelled')
    })

    it('ja ロケールで日本語メッセージを返すこと', () => {
      const fixedT = i18next.getFixedT('ja')
      expect(fixedT('commands.prune.messages.cancelled')).to.equal('pruneをキャンセルしました')
    })

    it('補間パラメータが解決されること', () => {
      const fixedT = i18next.getFixedT('en')
      expect(fixedT('commands.prune.messages.completed', {dir: './docs'})).to.equal('Prune completed for ./docs!')
    })
  })
})
