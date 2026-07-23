import {describe, expect, it} from 'vitest'

import {buildUpdatePlan} from './update-plan.js'

describe('buildUpdatePlan - downloadAttachmentsの解決', () => {
  it('フラグ指定が設定ファイルより優先されること', () => {
    const plan = buildUpdatePlan({downloadAttachments: false}, {downloadAttachments: true})
    expect(plan.downloadAttachments).to.be.true
  })

  it('フラグ未指定時は設定ファイルの値を引き継ぐこと', () => {
    const plan = buildUpdatePlan({downloadAttachments: true}, {})
    expect(plan.downloadAttachments).to.be.true
  })

  it('フラグも設定もない場合はfalseになること', () => {
    const plan = buildUpdatePlan({}, {})
    expect(plan.downloadAttachments).to.be.false
  })
})
