import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // scripts と .claude/hooks は、コミットメッセージの検査と Claude Code の hook のテスト
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs', '.claude/hooks/**/*.test.mjs'],
    testTimeout: 60_000,
  },
})
