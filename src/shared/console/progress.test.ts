import process from 'node:process'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {writeProgress} from './progress.js'

describe('progress - 進捗表示', () => {
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  let writeSpy: ReturnType<typeof vi.spyOn>

  const setIsTTY = (value: boolean | undefined): void => {
    Object.defineProperty(process.stdout, 'isTTY', {configurable: true, value})
  }

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    writeSpy.mockRestore()
    if (originalIsTTY) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTY)
    }
  })

  describe('writeProgress', () => {
    it('TTYの場合、行頭復帰と行末消去シーケンス付きでメッセージを書き込むこと', () => {
      setIsTTY(true)

      writeProgress('課題を取得中... (1/10件)')

      expect(writeSpy).toHaveBeenCalledOnce()
      expect(writeSpy).toHaveBeenCalledWith('\r\u001B[K課題を取得中... (1/10件)')
    })

    it('TTYの場合、短いメッセージへの切り替えでも消去シーケンスが先頭に付くこと', () => {
      setIsTTY(true)

      writeProgress('ドキュメント「とても長い名前のドキュメント」を処理中...')
      writeProgress('短い名前')

      expect(writeSpy).toHaveBeenNthCalledWith(2, '\r\u001B[K短い名前')
    })

    it('非TTYの場合、改行付きでメッセージを書き込むこと', () => {
      setIsTTY(false)

      writeProgress('Wikiを保存中... (5/20件)')

      expect(writeSpy).toHaveBeenCalledOnce()
      expect(writeSpy).toHaveBeenCalledWith('Wikiを保存中... (5/20件)\n')
    })

    it('非TTYの場合、行頭復帰や消去シーケンスを含まないこと', () => {
      setIsTTY(false)

      writeProgress('進捗メッセージ')

      const written = writeSpy.mock.calls[0][0] as string
      expect(written).not.to.include('\r')
      expect(written).not.to.include('\u001B[K')
    })
  })
})
