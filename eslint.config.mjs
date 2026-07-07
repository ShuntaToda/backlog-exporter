import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

export default [
  includeIgnoreFile(gitignorePath),
  ...oclif,
  prettier,
  {
    // テストは実装ファイルの兄弟（src/**/*.test.ts）にコロケーションしている。
    // chaiスタイルのアサーション（.to.be.true 等）と1ファイル複数describeを許可する
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'mocha/max-top-level-suites': 'off',
    },
  },
]
