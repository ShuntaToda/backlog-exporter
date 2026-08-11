# backlog-exporter

Backlog のデータをエクスポートするためのコマンドラインツール

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/backlog-exporter.svg)](https://npmjs.org/package/backlog-exporter)
[![Downloads/week](https://img.shields.io/npm/dw/backlog-exporter.svg)](https://npmjs.org/package/backlog-exporter)

## 目次

- [概要](#概要)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [コマンド一覧](#コマンド一覧)
- [課題のエクスポート (issue)](#課題のエクスポート-issue)
- [Wiki のエクスポート (wiki)](#wiki-のエクスポート-wiki)
- [ドキュメントのエクスポート (document)](#ドキュメントのエクスポート-document)
- [一括エクスポート (all)](#一括エクスポート-all)
- [データの更新 (update)](#データの更新-update)
- [削除されたデータの整理 (prune)](#削除されたデータの整理-prune)
- [添付ファイルのダウンロード](#添付ファイルのダウンロード)
- [出力形式](#出力形式)
- [その他の特徴](#その他の特徴)
- [開発への貢献](#開発への貢献)
- [ライセンス](#ライセンス)

## 概要

backlog-exporter は、Backlog のデータをローカルに Markdown ファイルとしてエクスポートするコマンドラインツールです。

- **課題（Issue）**：カスタム属性・コメント・添付ファイルを含めてエクスポート
- **Wiki**：階層構造を保持してエクスポート
- **ドキュメント**：ツリー構造を保持してエクスポート
- **一括エクスポート**：課題・Wiki・ドキュメントをまとめて取得
- **差分更新**：前回のエクスポート以降に変更されたデータのみを更新

## インストール

<!-- usage -->
```sh-session
$ npm install -g backlog-exporter
$ backlog-exporter COMMAND
running command...
$ backlog-exporter (--version)
backlog-exporter/1.1.0 linux-x64 node-v22.23.1
$ backlog-exporter --help [COMMAND]
USAGE
  $ backlog-exporter COMMAND
...
```
<!-- usagestop -->

インストールせずに `npx backlog-exporter <コマンド>` として実行することもできます。

## クイックスタート

利用には Backlog の **ドメイン**・**プロジェクト ID（またはキー）**・**API キー** が必要です。

API キーは以下のいずれかの方法で指定できます：

1. コマンドラインオプション `--apiKey` で指定
2. 環境変数 `BACKLOG_API_KEY` に設定
3. `.env` ファイルに `BACKLOG_API_KEY=あなたのAPIキー` として設定

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./backlog-data
```

上記で課題・Wiki・ドキュメントが `./backlog-data` 配下にエクスポートされます。2 回目以降は、エクスポートしたディレクトリで以下を実行するだけで差分更新できます：

```sh
$ backlog-exporter update
```

## コマンド一覧

| コマンド   | 説明                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `all`      | 課題・Wiki・ドキュメントを一括エクスポート                               |
| `issue`    | 課題をエクスポート（作成年ごとのフォルダに整理）                         |
| `wiki`     | Wiki を階層構造を保持してエクスポート                                    |
| `document` | ドキュメントをツリー構造を保持してエクスポート                           |
| `update`   | エクスポート済みデータを差分更新                                         |
| `prune`    | Backlog 上で削除・移動されたデータのローカルファイルを削除               |
| `help`     | ヘルプを表示                                                             |

全エクスポートコマンドで共通のフラグ：

| フラグ                      | 説明                                             |
| --------------------------- | ------------------------------------------------ |
| `--domain`                  | Backlog のドメイン（例: `example.backlog.jp`）   |
| `--projectIdOrKey`          | プロジェクトキーまたは数値 ID                    |
| `--apiKey`                  | API キー（環境変数でも指定可能）                 |
| `--output`                  | 出力先ディレクトリ                               |
| `-d, --downloadAttachments` | 添付ファイルもダウンロード（[詳細](#添付ファイルのダウンロード)） |

## 課題のエクスポート (issue)

`issue` コマンドは、Backlog の課題を Markdown ファイルとしてエクスポートします。課題は作成年ごとのサブディレクトリに整理されます。

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./issues
```

| フラグ               | 説明                                                       |
| -------------------- | ---------------------------------------------------------- |
| `--issueKeyFileName` | Markdown ファイル名を課題キーにする                        |
| `--issueKeyFolder`   | 課題キーごとにフォルダを作成する（両フラグは併用可能）     |

### カスタム属性の対応

課題のカスタム属性も Markdown テーブル形式で出力されます。改行やパイプ文字も適切に処理されます。

- **プリミティブ値**：文字列、数値などの単純な値
- **配列値**：複数選択のカスタム属性（カンマ区切りで表示）
- **オブジェクト値**：単一選択のカスタム属性（name または value プロパティを使用）

```markdown
## カスタム属性

| 属性名             | 値                             |
| ------------------ | ------------------------------ |
| 工数（エンジニア） | 3                              |
| 担当チーム         | フロントエンド, バックエンド   |
| 詳細               | 実装内容<br>- 機能A<br>- 機能B |
```

## Wiki のエクスポート (wiki)

`wiki` コマンドは、Backlog の Wiki ページを Markdown ファイルとしてエクスポートします。Wiki の階層構造はディレクトリ構造として再現されます。

```sh
$ backlog-exporter wiki --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./wiki
```

## ドキュメントのエクスポート (document)

`document` コマンドは、Backlog のドキュメントを Markdown ファイルとしてエクスポートします。

```sh
$ backlog-exporter document --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./documents
```

| フラグ      | 説明                                 |
| ----------- | ------------------------------------ |
| `--keyword` | キーワードに一致するドキュメントのみ取得 |

### ディレクトリ構造の保持

Backlog のドキュメントツリーの階層構造が、そのままローカルのディレクトリ構造として再現されます。フォルダはディレクトリに、ドキュメントは Markdown ファイルになります。子を持つ親ドキュメント自身が本文を持つ場合は、フォルダ内の `00_index.md` として保存されます（本文が空の親はファイルを作成しません）。

```
documents/
├── プロジェクト概要/
│   ├── 00_index.md          ← 親ドキュメント「プロジェクト概要」自身の本文
│   ├── 要件定義書.md
│   └── 仕様書.md
├── 設計書/
│   ├── システム設計/
│   │   ├── アーキテクチャ設計.md
│   │   └── データベース設計.md
│   └── UI設計/
│       ├── 画面設計書.md
│       └── ワイヤーフレーム.md
└── 運用手順書.md
```

作成者・更新者・タグ・添付ファイル情報などのメタデータも含めて保存されます。

### ツリーに現れないドキュメント

Backlog のドキュメントツリー（`/api/v2/documents/tree`）には、**作成後に一度も再保存されていないドキュメントが現れないことがあります**。そのため、ツリーの階層を辿るだけではこれらのドキュメントを取得できません。

backlog-exporter はツリーの走査に加えて、全件が載るドキュメント一覧（`/api/v2/documents`）と突き合わせ、ツリーに現れないドキュメントを**出力ディレクトリの直下**に保存します（ツリー上の位置が分からないため、階層は再現できません）。ゴミ箱のドキュメントは対象外です。

ただし、**作成後に一度も再保存しないままゴミ箱へ移動したドキュメント**は、Backlog の API 上で生きているドキュメントと区別できないため、対象に含まれてしまいます（ツリーにもゴミ箱ツリーにも現れず、一覧 API にだけ残るためです）。出力してほしくない場合は、ゴミ箱から完全に削除してください。

```
documents/
├── プロジェクト概要/
│   └── 要件定義書.md
└── ツリーに現れなかったドキュメント.md   ← 出力ルート直下に保存
```

出力ルート直下に同名のファイルを既に保存している場合（ツリー内のドキュメントと同じタイトルの場合など）は、**上書きせず警告を出してスキップ**します。

その後 Backlog 側でドキュメントを保存し直すとツリーに現れるようになり、以降は本来の階層に保存されます（出力ルート直下の古いファイルは `prune` で削除されます）。

## 一括エクスポート (all)

`all` コマンドは、課題・Wiki・ドキュメントを一度に取得します。課題は `issues`、Wiki は `wiki`、ドキュメントは `documents` サブディレクトリに保存されます。

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./backlog-data
```

### エクスポート対象の制御

| フラグ      | 説明                                                             |
| ----------- | ---------------------------------------------------------------- |
| `--only`    | 指定したデータタイプのみエクスポート（例: `--only issues,wiki`） |
| `--exclude` | 指定したデータタイプを除外（例: `--exclude documents`）          |

データタイプは `issues` / `wiki` / `documents` をカンマ区切りで指定します。`--only` と `--exclude` は同時に使用できません。

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --only issues,wiki
```

`--only` / `--exclude` を指定せずに対話端末で実行した場合は、Wiki・ドキュメントのどちらを取得するかを選択できます（Backlog は Wiki からドキュメントへの移行を予定しています）：

```
BacklogのWikiとドキュメントのどちらを取得しますか？（BacklogはWikiからドキュメントへの移行を予定しています）
  [1] 両方（デフォルト）  [2] Wikiのみ  [3] ドキュメントのみ
```

非対話環境（CI・パイプ実行）では両方を取得します。

## データの更新 (update)

`update` コマンドは、既存のエクスポートデータを最新の状態に更新します。ディレクトリ内の `backlog-settings.json` を探索し、見つかったディレクトリごとにデータを更新します。設定ファイルの最終更新日時（`lastUpdated`）以降に更新された項目のみを差分取得します。

```sh
$ backlog-exporter update
$ backlog-exporter update ./my-project
```

| フラグ            | 説明                                     |
| ----------------- | ---------------------------------------- |
| `--force`         | 確認プロンプトをスキップ                 |
| `--issuesOnly`    | 課題のみを更新                           |
| `--wikisOnly`     | Wiki のみを更新                          |
| `--documentsOnly` | ドキュメントのみを更新                   |
| `--apiKey`        | API キーを指定                           |

### 特定の項目だけを再取得する

「特定の項目だけを取り直したい」場合は、ID 指定フラグを使います。いずれもカンマ区切りで複数指定できます。

| フラグ           | 説明                                                     |
| ---------------- | -------------------------------------------------------- |
| `--issueIdOrKey` | 課題キー（`PROJECT-1`）または課題 ID（数値）で課題を再取得 |
| `--wikiId`       | Wiki ID（数値）で Wiki を再取得                          |
| `--documentId`   | ドキュメント ID でドキュメントを再取得                   |

```sh
$ backlog-exporter update --issueIdOrKey PROJECT-1,PROJECT-2
$ backlog-exporter update --wikiId 12345,12346
$ backlog-exporter update --documentId abc123,def456
```

- 指定したフラグに対応する項目のみを再取得し、それ以外の種別は更新しません（例: `--wikiId` のみ指定時は課題・ドキュメントを更新しません）
- 指定した項目以外のローカルファイルには影響しません

> **Note**: ID 指定フラグは全件差分更新ではないため、設定ファイルの最終更新日時（`lastUpdated`）は更新されません。次回の通常の差分更新に影響を与えません。

## 削除されたデータの整理 (prune)

`update`（および各取得コマンド）は増分更新（追加・上書き）のため、Backlog 上で削除・移動された課題・ドキュメント・Wiki のファイルはローカルに残り続けます。`prune` コマンドは、Backlog に存在しないローカルの `.md` ファイルと空になったディレクトリを削除して、Backlog と同じ状態に揃えます。

```sh
$ backlog-exporter prune
$ backlog-exporter prune ./backlog-documents
$ backlog-exporter prune --force
```

- 対象は **課題・ドキュメント・Wiki フォルダ** です（設定ファイルの `folderType` で判定します）
- ファイルを削除する破壊的な操作のため、実行時に確認プロンプトを表示します（`--force` でスキップ可能）
- 削除対象は `.md` ファイルのみ。`backlog-settings.json`・`backlog-update.log`・`.md` 以外のファイルには触れません。ただし、対象フォルダ内にユーザーが独自に置いた `.md` ファイルや空のディレクトリは、Backlog 上に存在しないものとして削除されるため注意してください
- ファイル名は保存時と同じロジックで比較します（ドキュメントは一覧 API の `title` 基準、課題は設定ファイルの `issueKeyFileName` / `issueKeyFolder` を反映）。サニタイズ差異による誤削除は起きません。ドキュメント情報の取得に失敗した場合は、誤削除を防ぐため何も削除せずに中止します
- [ツリーに現れないドキュメント](#ツリーに現れないドキュメント)として出力ルート直下に保存されたファイルも、保存時と同じ配置で保護されます
- 削除したファイルは `backlog-update.log` に記録されます

## 添付ファイルのダウンロード

`--downloadAttachments`（短縮形: `-d`）フラグを指定すると、課題・Wiki・ドキュメントの添付ファイルもダウンロードされます（`all` / `issue` / `wiki` / `document` / `update` コマンドで使用可能）。

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --downloadAttachments
```

保存先：

| 種別         | 保存先                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| 課題         | `{年}/attachments/{課題キー}/`（`--issueKeyFolder` 指定時は課題フォルダ直下の `attachments/`） |
| Wiki         | Markdown と同じディレクトリの `attachments/{Wiki名}/`（階層 Wiki は末尾のページ名）           |
| ドキュメント | Markdown と同じディレクトリの `attachments/{ドキュメント名}/`                                 |

- ファイル名は同名の衝突を避けるため `{添付ID}_{ファイル名}` になります
- Markdown の `## 添付ファイル` セクションにローカルファイルへの相対リンクが記載されます（フラグ未指定時はファイル名とサイズのみ記載）
- 課題の本文・コメント内の添付画像のインライン記法（`![image][ファイル名]` / `#image(ファイル名)`）は、ダウンロード済みファイルへの画像リンクに変換され、Markdown ビューアでそのまま表示できます
- Wiki・ドキュメントの本文は Backlog の原文のまま維持されます（添付参照記法の書き換えは行いません）。添付ファイルへは `## 添付ファイル` セクションのリンクからアクセスできます
- ダウンロード済みのファイルは再ダウンロードされないため、`update` コマンドでの差分更新でも効率的に動作します
- 設定は `backlog-settings.json` に保存され、以降の `update` コマンドで自動的に引き継がれます（`update` コマンド自体でフラグを指定した場合はその実行のみ有効です）
- Backlog 側で削除された添付ファイルは、誤削除防止のため `prune` コマンドでも削除されず残ります

## 出力形式

### 本文マーカー

課題の詳細・Wiki の本文・ドキュメントの内容といった「本文」部分は、種別を問わず以下の HTML コメントマーカーで囲まれて出力されます。

```markdown
<!-- backlog-exporter:body:start -->
ここが本文（## 見出しなどを含んでもよい）
<!-- backlog-exporter:body:end -->
```

- マーカーは Markdown のレンダリング時には表示されません（HTML コメント）
- 本文自体が `##` 見出しなどを含んでいても、開始・終了マーカー間を本文として機械的に抽出・差し替えできます
- 本文を Backlog へ書き戻す（API 反映する）ツールなどが、どこからどこまでが本文かを一意に判定するために使えます
- 子を持つ親ドキュメントの本文（`00_index.md`）にも同じマーカーが付きます

**抽出時の規約**: 本文自体がマーカーと同じ文字列を含む可能性があるため（例: このツールの使い方を Backlog 上にメモした場合）、抽出ツールは「ファイル内で**最初に現れる開始マーカー**から**最後に現れる終了マーカー**まで」を本文とみなしてください。

### 課題の出力形式

```markdown
# 課題のタイトル

## 基本情報

- 課題キー: PROJ-123
- ステータス: 処理中
- 優先度: 高
- 担当者: 山田太郎
- 作成日時: 2023/01/01 10:00:00
- 更新日時: 2023/01/02 15:30:45
- [Backlog Issue Link](https://example.backlog.jp/view/PROJ-123)

## カスタム属性

| 属性名             | 値                             |
| ------------------ | ------------------------------ |
| 工数（エンジニア） | 3                              |
| 担当チーム         | フロントエンド, バックエンド   |
| 詳細               | 実装内容<br>- 機能A<br>- 機能B |

## 詳細

<!-- backlog-exporter:body:start -->
ここに課題の詳細説明が入ります。
<!-- backlog-exporter:body:end -->

## コメント

### コメント 1

- **投稿者**: 佐藤次郎
- **日時**: 2023/01/01 11:15:30

コメントの内容がここに表示されます。
```

### Wiki の出力形式

```markdown
# Wiki のタイトル

[Backlog Wiki Link](https://example.backlog.jp/alias/wiki/12345)

<!-- backlog-exporter:body:start -->
ここに Wiki の本文内容が入ります。
Backlog の書式がそのまま保持されます。
<!-- backlog-exporter:body:end -->
```

### ドキュメントの出力形式

```markdown
# ドキュメントのタイトル

[Backlog Document Link](https://example.backlog.jp/document/DOC-ID)

**ステータス**: 1 🎉
**作成者**: 山田太郎
**作成日時**: 2023/01/01 10:00:00
**更新者**: 佐藤次郎
**更新日時**: 2023/01/02 15:30:45

## 内容

<!-- backlog-exporter:body:start -->
ここにドキュメントの本文内容が入ります。
Backlog の書式がそのまま保持されます。
<!-- backlog-exporter:body:end -->

## 添付ファイル

- **資料.pdf** (1024.5 KB) - 作成者: 山田太郎, 作成日時: 2023/01/01 10:00:00

## タグ

- 仕様書
- 設計書
```

## その他の特徴

- **自動ディレクトリ作成**：出力ディレクトリが存在しない場合は自動的に作成
- **並列処理**：並列処理による高速なダウンロード
- **レート制限対応**：API のレート制限に達した場合は自動的に待機してリトライ
- **ファイル名サニタイズ**：不正な文字を自動的に除去して安全なファイル名を生成

## 開発への貢献

backlog-exporter はオープンソースプロジェクトです。バグ報告、機能提案、プルリクエストなど、あらゆる形での貢献を歓迎しています。

詳しくは [CONTRIBUTING.md](docs/CONTRIBUTING.md) をご覧ください。

## ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。
