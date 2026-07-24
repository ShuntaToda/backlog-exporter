import {describe, expect, it} from 'vitest'

import {sleep} from './sleep.js'

describe('sleep', () => {
  it('指定した時間だけ待機すること', async () => {
    const startTime = Date.now()
    await sleep(1000) // 1秒待機
    const endTime = Date.now()
    const elapsedTime = endTime - startTime

    // 誤差を考慮して、待機時間が900ms以上1100ms以下であることを確認
    expect(elapsedTime).to.be.at.least(900)
    expect(elapsedTime).to.be.at.most(1100)
  })
})
