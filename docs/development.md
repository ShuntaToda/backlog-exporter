# 開発の決まりと仕組み

決まりの一覧と違反のメッセージは [AGENTS.md](../AGENTS.md)、手元の準備と貢献の流れは [CONTRIBUTING.md](CONTRIBUTING.md) にあります。ここには、つくりと、決まりを道具で縛っている仕組みの理由を残します。

## 層と置き場

```
src/
├── index.ts          # oclif の入口
├── commands/         # コマンド。フラグを読み、composition で組み立てて use-case を呼ぶ
├── composition/      # repository の組み立て（HTTP クライアントを 1 つ作って共有する）
├── modules/<名前>/
│   ├── domain/       # 判断・変換（Markdown の組み立て・保存先のパス・更新の要否・消す対象）。入出力を持たない
│   ├── use-case/     # 手順（取得 → domain で判断 → 保存）
│   └── repository/   # Backlog API・ファイルとのやりとり。domain のインターフェースを満たす
└── shared/           # modules から使う共通の部品。直下の ports.ts・attachment.ts・file-name.ts・backlog-url.ts は入出力を持たず、domain から使ってよい
    ├── backlog/      # HTTP クライアント（API キーの伏せ字・429 の待ち）
    ├── storage/      # ファイルへの保存・更新ログ
    ├── console/      # 進捗・入力
    ├── config/       # 環境変数・.env
    ├── markdown/     # 本文の印
    └── testing/      # テスト用のモックサーバー（ビルドに入れない）
```

import の向きは、外から内への一方向です。

- `commands`・`composition` → `modules` → `shared`（`shared` は `modules` を知らない）
- `modules` の中は `use-case` → `domain`、`repository` → `domain`。`use-case` は `repository` を呼んでよいが、逆はない
- `domain` は入出力の部品（`shared/storage`・`backlog`・`console`・`config`・`testing`）と `repository` を使わない。時刻・乱数も引数で受ける（同じ入力で同じ結果を返し、テストで値を固定できるように）

## 道具で縛っている仕組みと理由

決まりは、文章より道具で縛ります。AI も人も、文章の決まりは読み落とすが、落ちた検査のメッセージは読むからです。

| 仕組み                                                                                               | 防ぐもの                                                                                    | 引き受けているもの（遅さ・誤検出・保守）                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import/no-restricted-paths`（`eslint.config.mjs` の `layerZones`）                                  | 層の向きの逆流。判断が入出力に混ざり、テストに本物のファイル・通信が要るようになること      | 既にある違反 1 件（`content-selection.ts` が use-case の型を読む）を、理由つきの例外にしている。テストは本物の組み立て（composition）を使ってよいので、テストには掛けない |
| `import/no-cycle`                                                                                    | 層の決まりをすり抜ける相互依存・読み込み順の不具合                                          | eslint が数秒伸びる（import 先を読む）                                                                                                                                    |
| `no-restricted-imports`・`no-restricted-properties`・`no-restricted-globals`・`no-restricted-syntax` | oclif・環境変数・通信・時刻が、決めた置き場の外に散らばること                               | `no-restricted-imports`・`no-restricted-syntax` は後の設定が前を上書きするので、domain の設定には src 全体の分も含めて書いている                                          |
| `@typescript-eslint/no-non-null-assertion`・二重のアサーションの禁止                                 | 型の検査を外して通すこと                                                                    | 既にある `!` 1 件（`backlog-issue-repository.ts`）を、理由つきの例外にしている                                                                                            |
| `reportUnusedDisableDirectives`                                                                      | 直したあとに残った disable                                                                  | なし                                                                                                                                                                      |
| `@eslint-community/eslint-comments`（`no-restricted-disable`・`no-unlimited-disable` ほか）          | 構造のルールを disable で外すこと・ルールを書かない disable                                 | 理由（`-- 理由`）の無い disable は、既にあるもの（`no-await-in-loop`）が多いので、まだ落とさない                                                                          |
| `scripts/eslint-config.test.mjs`（`ESLint#lintText`）                                                | 足した設定が、oclif のルールや別の場所の決まりを黙って上書きすること                        | 決まりを足すたびに、落ちる例と通る例をここに足す                                                                                                                          |
| prettier（CI の `npm run format:check`）                                                             | 整形の違い                                                                                  | 整っていない既存のファイルを `.prettierignore` に載せている。src を並行して直している PR が入ったあとに一括で整え、README.md 以外を消す                                   |
| `npm run typecheck`（`tsc --noEmit`）                                                                | テスト・e2e の型の誤り（`npm run build` は `tsconfig.build.json` でテストを外すため見ない） | CI が数秒伸びる                                                                                                                                                           |
| lefthook（`lefthook.yml`）                                                                           | 整形・lint の違反、型の誤り・落ちるテストが手元からそのまま入ること                         | `npm install` の `prepare` で入る。入れたくないときは `LEFTHOOK=0`                                                                                                        |

### Claude Code の hook

`.claude/settings.json` に 2 つの hook があります（`.claude/hooks/`。依存なし。Node の組み込みだけ）。

- `lint-edited-file.mjs`（PostToolUse: Edit・Write・MultiEdit）: 編集したファイルに eslint と prettier をかけ、違反を終了コード 2 で AI に返す
- `check-on-stop.mjs`（Stop）: 手を止める前に、まだコミットしていない変更に eslint・prettier と、`src`・`e2e` の `.ts` か `tsconfig*.json` を変えていれば `tsc --noEmit` をかける。同じ停止で 2 度は止めない

道具は `node_modules` の中の JS の入口を Node で直に動かします（Windows の `.cmd` を shell で動かすと、空白を含むパスで誤った失敗を返すため）。hook の中の失敗（道具が無い・git が無い・時間切れ・入力が読めない）では 0 で終え、作業を止めません。`--untracked-files=all` で変更を拾うので、CLI を試すときはリポジトリの外に書き出します。

hook のテストは `.claude/hooks/hooks.test.mjs` です。

## 道具で縛る決まりを足す

決まりを足す・変えるときは、次の順で考えます（上で済むなら下は足さない）。

道具で守る相手は「AI が自然に書いてしまう形」です。頼まれた機能を素直に書いたら決まりから外れていた、という形（commands で判断を書く・domain で `new Date()` を呼ぶ・use-case で `process.env` を読む）は、道具で落とします。わざと検査を外す書き方（`as unknown as X`・`Reflect`・文字列の連結での難読化）は、安く塞げるものだけ塞ぎ、残りは人のレビューとレビュー役（`.claude/agents/architecture-reviewer.md` の「黙らせ方」）が見ます。

1. **構造で防げないか**: 置き場・型・インターフェースで、そもそも書けない形にする
2. **既存の lint ルールで書けないか**: `eslint.config.mjs` に足す。`no-restricted-imports`・`no-restricted-globals`・`no-restricted-properties`・`no-restricted-syntax`・`import/no-restricted-paths` は `message` に直し方を書ける
3. **ファイルどうしの対応**（A があれば B もある）なら、テストに足す

足すときに守ること:

- `scripts/eslint-config.test.mjs` に、落ちる例と通る例を足す
- メッセージは日本語で、「何が決まりか・どう直すか・どこへ置くか」を書く（AI がメッセージだけで直せるように）。メッセージを書けないルール（`no-console` など）は、`.claude/hooks/hook-util.mjs` の `HINTS` に直し方を足す
- 今のコードに違反があれば、例外を足さずにコードを直す。直せない例外は、`eslint.config.mjs` に理由のコメントを付けて 1 ファイルずつ書く
- わざと違反を入れて、落ちること・メッセージで直せることを確かめる
- [AGENTS.md](../AGENTS.md#道具で縛っている決まり) の表に 1 行足し、上の表に防ぐものと引き受けるものを書く

## リリースと互換性

npm に出しているので、使う人は前に書き出したフォルダに `update`・`prune` をかけ続けます。次は崩しません。崩すときは README に移し方を書いてから入れます。

- コマンド名・フラグ名
- 保存するフォルダとファイルの名前の決め方（課題キー・年のフォルダ・Wiki の階層・ドキュメントの `00_index.md`）
- `backlog-settings.json` の項目（無い項目は前からの設定として読めるようにする）
- Markdown の本文の印（`<!-- backlog-exporter:body:start -->`。`update` が本文を差し替えるときに使う）
