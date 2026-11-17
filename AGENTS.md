# AGENTS.md

AI のコーディングエージェント向けの、このリポジトリでの約束です（人向けの説明は README.md と docs/）。

## このリポジトリ

Backlog の課題・Wiki・ドキュメントを取得して Markdown に保存する CLI です（oclif・TypeScript・Node.js 22 以上）。npm に `backlog-exporter` として出しています。

- `src/commands/` — oclif のコマンド（`all`・`issue`・`wiki`・`document`・`update`・`prune`）。フラグを読み、組み立てて use-case を呼ぶだけの薄い層
- `src/composition/` — repository の組み立て（1 つの HTTP クライアントを全 repository で共有する）
- `src/modules/<名前>/` — 機能ごとのまとまり。`domain/`（判断・変換。入出力を持たない）・`use-case/`（手順。domain と repository をつなぐ）・`repository/`（Backlog API・ファイルとのやりとり）
- `src/shared/` — modules から使う共通の部品（`backlog/` は HTTP クライアント、`storage/` はファイルへの保存、`console/` は進捗・入力、`config/` は環境変数、`testing/` はテスト用のモックサーバー）
- `e2e/` — ビルドした CLI を、モックサーバーに向けて動かす結合テスト
- `scripts/` — 開発用のスクリプト（`check-commit-message.mjs`: コミットメッセージの決まり）
- `.claude/` — Claude Code の hook（`hooks/`。編集のたびに検査を返す）とレビュー用のサブエージェント（`agents/`）

層の向きと、どこに何を置くかは [docs/development.md](docs/development.md#層と置き場) にあります。

## 守ること

下は、道具で縛れない決まりです。道具で縛っている決まりは、その下の表にあります（破ると lint・テスト・CI が落ち、メッセージに直し方が出ます）。

- 業務の判断（何を取得するか・どこに保存するか・更新が要るか・何を消すか）は domain に置く。commands と repository には判断を書かず、use-case は手順だけにする
- 足した分岐・エラー・境界の値（0 件・上限の 100 件ちょうど・前からの設定ファイルに項目が無い）にテストを書く。テストは実装の兄弟（`<名前>.test.ts`）に置き、Backlog への通信はモックサーバー（`src/shared/testing/backlog-mock-server.ts`）で受ける
- API キーを出力・ログ・エラーメッセージ・保存するファイルに出さない（URL に載るものは `BacklogHttpClient` が伏せ字にする）
- 生成物を手で直さない: README のコマンドの節（`oclif readme`）・`oclif.manifest.json`（`oclif manifest`）
- 使う人が頼っている形は崩さない: コマンド名・フラグ名・保存するフォルダとファイルの名前の決め方・`backlog-settings.json` の項目・Markdown の本文の印（`src/shared/markdown/body-marker.ts`）。崩すなら README に移し方を書く
- 例に使う名前・ドメインは架空のもの（`example.backlog.jp`・`PROJECT_KEY`・山田 太郎）にする
- 画面に出す文言・エラーメッセージは日本語で書く
- コミットのメッセージは日本語で短く、`feat:`・`fix:`・`docs:`・`test:`・`refactor:`・`chore:`・`ci:` を頭に付ける
- コメントに書くのは「なぜ・出典・外の制約（Backlog API の仕様など）」だけ。道具で縛れる決まりは、コメントではなく道具に移す

## 道具で縛っている決まり

違反したら、メッセージのとおりに直します。`eslint-disable`・ignore・`any`・`!` で黙らせません（どうしても要るときは、`-- 理由` を付けた 1 行だけの disable にし、PR に書く。理由の有無はまだ道具で縛っていない）。道具が守るのは「自然に書いてしまう形」までです。わざと検査を外す書き方（二重のアサーション・難読化）は、道具をすり抜けても決まりの違反です。決まりを足す・変えるときは [docs/development.md](docs/development.md#道具で縛る決まりを足す)。

| 決まり                                                                                                                                                     | 縛っている道具                                                                                                                            | 違反したときのメッセージ（先頭）                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 層の import の向き（commands・composition → modules → shared。modules の中は use-case → domain、repository → domain。domain は入出力の shared を使わない） | eslint `import/no-restricted-paths`                                                                                                       | 「commands・composition は最外殻です…」「domain は入出力…を持ちません」ほか        |
| `src/shared/testing`（テスト用。ビルドに入れない）を本番のコードから import しない                                                                         | eslint `import/no-restricted-paths`                                                                                                       | 「src/shared/testing はテスト用です…」                                             |
| 循環 import を作らない                                                                                                                                     | eslint `import/no-cycle`                                                                                                                  | `Dependency cycle detected`                                                        |
| oclif（`@oclif/*`）を import するのは `src/commands` と `src/index.ts` だけ                                                                                | eslint `no-restricted-imports`                                                                                                            | 「oclif（@oclif/\*）を import できるのは…」                                        |
| domain は `node:path` 以外の Node の組み込みを import しない。今の時刻（`new Date()`・`Date.now()`）・乱数を直に取らない                                   | eslint `no-restricted-imports`・`no-restricted-syntax`                                                                                    | 「domain は node:path 以外の…」「domain で今の時刻を直に取りません」               |
| 環境変数（`process.env`）を読むのは `src/shared/config` だけ                                                                                               | eslint `no-restricted-properties`                                                                                                         | 「環境変数（process.env）を読めるのは…」                                           |
| Backlog への通信（`fetch`）は `src/shared/backlog` を通す                                                                                                  | eslint `no-restricted-globals`                                                                                                            | 「Backlog への通信は src/shared/backlog の…」                                      |
| modules の出力は Logger を通す（`console` を使わない）                                                                                                     | eslint `no-console`                                                                                                                       | `Unexpected console statement`（hook が直し方を添える）                            |
| `any`・`!`（テストの外）・二重のアサーション `as unknown as T`（テストの外）を使わない                                                                     | eslint `@typescript-eslint/*`・`no-restricted-syntax`                                                                                     | 各ルールのメッセージ・「二重のアサーション（as unknown as T）は使いません」        |
| 構造のルール（層の向き・循環・`no-restricted-*`・`no-console`・`any`・`!`）を disable で外さない。ルールを書かない disable を使わない                      | eslint `@eslint-community/eslint-comments/*`                                                                                              | `Disabling '…' is not allowed`・`Unexpected unlimited 'eslint-disable' comment`    |
| 直したあとに残った disable を残さない                                                                                                                      | eslint `reportUnusedDisableDirectives`                                                                                                    | `Unused eslint-disable directive`                                                  |
| 型の厳しさ（`strict`）。テストと e2e も型を確かめる                                                                                                        | `tsc`（`npm run typecheck`）                                                                                                              | TypeScript のエラー                                                                |
| 整形                                                                                                                                                       | prettier（`@oclif/prettier-config`。CI は `npm run format:check`）。整っていない既存のファイルは `.prettierignore` に理由つきで載せている | `Code style issues found`。hook と pre-commit は `npx prettier --write` を案内する |
| コミットのメッセージは 1 行・AI の署名なし（マージコミットと、`git revert` の決まった本文を除く）                                                          | lefthook `commit-msg`・CI の `commit-messages`（`scripts/check-commit-message.mjs`）                                                      | 「コミットメッセージは 1 行にしてください」                                        |

eslint の設定が決めた場所に決めたルールを掛けているかは、`scripts/eslint-config.test.mjs` が確かめます。

Claude Code では、編集のたびにそのファイルの eslint・prettier が、手を止める前に変更したファイルの eslint・prettier と tsc が動き、違反が返ります（`.claude/settings.json` の hook。docs/development.md「Claude Code の hook」）。同じ設定で、コミットに AI の署名を付けないようにしています。

## 確かめる

```bash
npm install            # lefthook の hook も入る（prepare）
npm run lint
npm run typecheck
npm test               # src のテスト・コミットメッセージの検査と hook のテスト（終わると lint も動く）
npm run test:e2e       # ビルドして、CLI をモックサーバーに向けて動かす
```

PR を出す前に、レビュー役のサブエージェント（`.claude/agents/architecture-reviewer.md`）に、書いた文脈と別の目で変更を読ませます。PR の本文は `.github/pull_request_template.md` の形で書きます。

本物の Backlog に向けて動かす・npm に出すのは人が決めます。
