import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const gitignorePath = path.resolve(rootDir, '.gitignore')

/**
 * oclif の設定が付けているルールの options。flat config では後の設定が同じルールの options を丸ごと置き換えるので、
 * 決まりを足すときは、これを含めて書く（含めないと oclif の分が黙って消える）
 */
const oclifOptionsOf = (rule) => {
  const config = oclif.findLast((entry) => entry.rules?.[rule] !== undefined)
  const value = config?.rules[rule]
  return Array.isArray(value) ? value.slice(1) : []
}

const oclifRestrictedImports = oclifOptionsOf('no-restricted-imports')
const oclifRestrictedGlobals = oclifOptionsOf('no-restricted-globals')

const oclifImportMessage = {
  group: ['@oclif/*'],
  message:
    'oclif（@oclif/*）を import できるのは src/commands と src/index.ts だけです。フラグ・出力は commands で受け、値と Logger を渡してください',
}

// 層の import の向き（commands → composition → modules（use-case → domain・repository → domain）→ shared）。
// 置き場と向きの理由は docs/development.md「層と置き場」
// zone の from は「glob だけ」か「glob なし」のどちらかにする（混ぜると eslint-plugin-import が設定の誤りとして扱う）
const domainIoMessage =
  'domain は入出力（ファイル・HTTP・コンソール・環境変数）を持ちません。入出力は use-case か repository に置き、domain には結果の値を渡してください'

const layerZones = [
  {
    from: ['./src/commands', './src/composition', './src/index.ts'],
    message:
      'commands・composition は最外殻です。modules・shared からは import できません。要る値は引数（Logger・リポジトリ）で受けてください',
    target: ['./src/modules', './src/shared'],
  },
  {
    from: './src/modules',
    message:
      'shared は modules を知りません。modules の型・関数が要るなら、それを shared に移すか、引数で受けてください',
    target: './src/shared',
  },
  {
    from: './src/modules/*/use-case/**',
    message: 'repository から use-case は import できません。use-case が repository を呼ぶ向きにしてください',
    target: './src/modules/*/repository/**',
  },
  {
    from: './src/modules/*/repository/**',
    message: domainIoMessage,
    target: './src/modules/*/domain/**',
  },
  {
    from: [
      './src/shared/storage',
      './src/shared/backlog',
      './src/shared/console',
      './src/shared/config',
      './src/shared/testing',
    ],
    message: domainIoMessage,
    target: './src/modules/*/domain/**',
  },
]

const testingZone = {
  from: './src/shared/testing',
  message: 'src/shared/testing はテスト用です（ビルドに入れない）。本番のコードから import できません',
  target: ['./src/commands', './src/composition', './src/modules', './src/index.ts'],
}

const domainUseCaseZone = {
  from: './src/modules/*/use-case/**',
  message: 'domain から use-case は import できません。両方が使う型は domain に置いてください',
  target: './src/modules/*/domain/**',
}

const doubleAssertion = {
  message: '二重のアサーション（as unknown as T）は使いません。型を絞る（型ガードなど）か、型の定義を直してください',
  selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
}

const testFiles = ['src/**/*.test.ts', 'e2e/**/*.ts', 'scripts/**/*.test.mjs', '.claude/hooks/**/*.test.mjs']

export default [
  includeIgnoreFile(gitignorePath),
  {
    linterOptions: {
      // 直したあとに残った disable を落とす
      reportUnusedDisableDirectives: 'error',
    },
  },
  ...oclif,
  prettier,
  comments.recommended,
  {
    rules: {
      // 構造を守るルールは disable で外さない（例外は、この設定に理由つきで書く）
      '@eslint-community/eslint-comments/no-restricted-disable': [
        'error',
        'import/no-restricted-paths',
        'import/no-cycle',
        'no-restricted-*',
        'no-console',
        '@typescript-eslint/no-explicit-any',
        '@typescript-eslint/no-non-null-assertion',
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    // テストは本物の組み立て（composition）を使ってよい
    ignores: ['**/*.test.ts'],
    rules: {
      'import/no-cycle': 'error',
      'import/no-restricted-paths': [
        'error',
        {basePath: rootDir, zones: [...layerZones, testingZone, domainUseCaseZone]},
      ],
    },
  },
  {
    // 既にある違反（ExportTarget の型を use-case から読んでいる）。型を domain に移したら、この例外を消す
    files: ['src/modules/all/domain/content-selection.ts'],
    rules: {
      'import/no-restricted-paths': ['error', {basePath: rootDir, zones: [...layerZones, testingZone]}],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/commands/**', 'src/index.ts'],
    rules: {
      'no-restricted-imports': ['error', {paths: oclifRestrictedImports, patterns: [oclifImportMessage]}],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/shared/config/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          message:
            '環境変数（process.env）を読めるのは src/shared/config だけです。読む関数を src/shared/config に足し、commands から値を渡してください',
          object: 'process',
          property: 'env',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/shared/backlog/**', '**/*.test.ts', 'src/shared/testing/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...oclifRestrictedGlobals,
        {
          message:
            'Backlog への通信は src/shared/backlog の BacklogHttpClient を通します（API キーの伏せ字・レート制限の待ちをそこで持つため）',
          name: 'fetch',
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      // modules の出力は Logger（src/shared/ports.ts）を引数で受けて使う（no-console は message を書けないため、ここに残す）
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts', 'src/shared/testing/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': ['error', doubleAssertion],
    },
  },
  {
    // 既にある違反（comments.at(-1)! ）。直したら、この例外を消す
    files: ['src/modules/issue/repository/backlog-issue-repository.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // domain の決まり。no-restricted-imports・no-restricted-syntax は後の設定が前を上書きするので、src 全体と oclif の分も含めてここに書く
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: oclifRestrictedImports,
          patterns: [
            oclifImportMessage,
            {
              group: ['node:*', '!node:path'],
              message:
                'domain は node:path 以外の Node の組み込み（fs・os・process・http など）を import しません。入出力は use-case か repository に置いてください',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          message:
            'domain で今の時刻を直に取りません（new Date() の引数なし）。時刻は use-case から引数で渡してください',
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        },
        {
          message: 'domain で今の時刻を直に取りません（Date.now()）。時刻は use-case から引数で渡してください',
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        },
        {
          message: 'domain で乱数を直に取りません。値は引数で渡してください',
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
        },
        doubleAssertion,
      ],
    },
  },
  {
    // テストは実装ファイルの兄弟（src/**/*.test.ts）にコロケーションしている。
    // chaiスタイルのアサーション（.to.be.true 等）と1ファイル複数describeを許可する
    files: testFiles,
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'mocha/max-top-level-suites': 'off',
      // vitestのフック/スイートをmochaプラグインが誤検知するため
      'mocha/no-top-level-hooks': 'off',
    },
  },
]
