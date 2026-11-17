import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

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
  {
    files: ['src/**/*.ts'],
    // テストは本物の組み立て（composition）を使ってよい
    ignores: ['**/*.test.ts'],
    rules: {
      'import/no-cycle': 'error',
      'import/no-restricted-paths': ['error', {zones: [...layerZones, domainUseCaseZone]}],
    },
  },
  {
    // 既にある違反（ExportTarget の型を use-case から読んでいる）。型を domain に移したら、この例外を消す
    files: ['src/modules/all/domain/content-selection.ts'],
    rules: {
      'import/no-restricted-paths': ['error', {zones: layerZones}],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/commands/**', 'src/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@oclif/*'],
              message:
                'oclif（@oclif/*）を import できるのは src/commands と src/index.ts だけです。フラグ・出力は commands で受け、値と Logger を渡してください',
            },
          ],
        },
      ],
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
  // domain の決まり。no-restricted-imports・no-restricted-syntax は後の設定が前を上書きするので、src 全体の分も含めてここに書く
  {
    files: ['src/modules/*/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@oclif/*'],
              message: 'domain から oclif は import できません',
            },
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
