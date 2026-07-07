import {describe, expect, it} from 'vitest'

import {BODY_END_MARKER, BODY_START_MARKER, wrapBody} from './body-marker.js'

describe('body-marker', () => {
  describe('wrapBody', () => {
    it('本文を開始・終了マーカーで囲むこと', () => {
      expect(wrapBody('あいうえお')).to.equal(`${BODY_START_MARKER}\nあいうえお\n${BODY_END_MARKER}`)
    })

    it('本文が##見出しを含んでもそのまま保持されること', () => {
      const body = '本文の先頭\n\n## 本文内の見出し\n本文のつづき'
      expect(wrapBody(body)).to.equal(`${BODY_START_MARKER}\n${body}\n${BODY_END_MARKER}`)
    })
  })
})
