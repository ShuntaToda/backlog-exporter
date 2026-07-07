import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // oclifのthis.logはconsole.log経由のため、vitestのコンソール横取りを無効化して
    // @oclif/testのcaptureOutputに届くようにする
    disableConsoleIntercept: true,
    include: ['e2e/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
