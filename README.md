# backlog-exporter

Backlog のデータをエクスポートするためのコマンドラインツール

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/backlog-exporter.svg)](https://npmjs.org/package/backlog-exporter)
[![Downloads/week](https://img.shields.io/npm/dw/backlog-exporter.svg)](https://npmjs.org/package/backlog-exporter)

<!-- toc -->
* [backlog-exporter](#backlog-exporter)
* [概要](#概要)
* [インストール](#インストール)
* [使用方法](#使用方法)
* [課題のエクスポート](#課題のエクスポート)
* [Wiki のエクスポート](#wiki-のエクスポート)
* [ドキュメント のエクスポート](#ドキュメント-のエクスポート)
* [課題・Wiki・ドキュメント の一括エクスポート](#課題wikiドキュメント-の一括エクスポート)
* [データの更新](#データの更新)
* [特定の課題だけを再取得（課題キーまたは課題ID）](#特定の課題だけを再取得課題キーまたは課題id)
* [特定のWikiだけを再取得（Wiki ID）](#特定のwikiだけを再取得wiki-id)
* [特定のドキュメントだけを再取得（ドキュメントID）](#特定のドキュメントだけを再取得ドキュメントid)
* [カレントディレクトリ配下の設定ファイルを探索して実行](#カレントディレクトリ配下の設定ファイルを探索して実行)
* [対象ディレクトリを指定](#対象ディレクトリを指定)
* [確認プロンプトをスキップ](#確認プロンプトをスキップ)
* [コマンド](#コマンド)
* [出力形式](#出力形式)
* [課題のタイトル](#課題のタイトル)
* [Wiki のタイトル](#wiki-のタイトル)
* [ドキュメントのタイトル](#ドキュメントのタイトル)
* [その他の特徴](#その他の特徴)
<!-- tocstop -->

# 概要

backlog-exporter は、Backlog のデータをローカルにエクスポートするためのコマンドラインツールです。
現在、以下の機能をサポートしています：

- **課題（Issue）のエクスポート**：Backlog の課題を Markdown ファイルとして保存（カスタム属性対応）
- **Wiki 記事のエクスポート**：Backlog の Wiki 記事を Markdown ファイルとして保存
- **ドキュメントのエクスポート**：Backlog のドキュメントを Markdown ファイルとして保存
- **一括エクスポート**：課題・Wiki・ドキュメントを同時に取得する機能
- **データの更新**：既存のエクスポートデータを最新の状態に更新する機能

# インストール

<!-- usage -->
```sh-session
$ npm install -g backlog-exporter
$ backlog-exporter COMMAND
running command...
$ backlog-exporter (--version)
backlog-exporter/1.0.0 darwin-arm64 node-v22.22.2
$ backlog-exporter --help [COMMAND]
USAGE
  $ backlog-exporter COMMAND
...
```
<!-- usagestop -->

# 使用方法

backlog-exporter を使用するには、Backlog のドメイン、プロジェクト ID（またはキー）、API キーが必要です。

API キーは以下の方法で指定できます：

1. コマンドラインオプションとして指定
2. 環境変数 `BACKLOG_API_KEY` に設定
3. `.env` ファイルに `BACKLOG_API_KEY=あなたのAPIキー` として設定

## 基本的な使用例

**課題のエクスポート**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./issues
```

**Wikiのエクスポート**

```sh
$ backlog-exporter wiki --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./wiki
```

**ドキュメントのエクスポート**

```sh
$ backlog-exporter document --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./documents
```

**課題・Wiki・ドキュメントの一括エクスポート**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./backlog-data
```

**特定のデータタイプのみをエクスポート（onlyフラグ）**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --only issues,wiki
```

**特定のデータタイプを除外してエクスポート（excludeフラグ）**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --exclude documents
```

**データの更新**

```sh
$ backlog-exporter update
```

npx を使用する場合は、コマンドの前に`npx`を付けるだけです：

**npxを使った課題のエクスポート**

```sh
$ npx backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./issues
```

**npxを使ったデータの更新**

```sh
$ npx backlog-exporter update
```

# 課題のエクスポート

`issue`コマンドを使用すると、Backlog の課題を Markdown ファイルとしてエクスポートできます。

**基本的な使用方法**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
```

**出力先を指定**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./issues
```

**Markdownファイル名を課題キーにする**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName
```

**課題キーでフォルダを作成する**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFolder
```

**課題キーでフォルダを作成し、Markdownファイル名も課題キーにする**

```sh
$ backlog-exporter issue --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --issueKeyFileName --issueKeyFolder
```

エクスポートされた課題は、指定したディレクトリ内に Markdown ファイルとして保存されます。ファイル名は課題のキーに基づいて自動的に生成されます。

## カスタム属性の対応

課題のエクスポートでは、Backlogのカスタム属性も含めて出力されます：

### 対応している値の型

- **プリミティブ値**: 文字列、数値などの単純な値
- **配列値**: 複数選択のカスタム属性（カンマ区切りで表示）
- **オブジェクト値**: 単一選択のカスタム属性（name または value プロパティを使用）

### 表示形式

カスタム属性はMarkdownテーブル形式で表示され、改行やパイプ文字も適切に処理されます：

```markdown
## カスタム属性

| 属性名             | 値                             |
| ------------------ | ------------------------------ |
| 工数（エンジニア） | 3                              |
| 担当チーム         | フロントエンド, バックエンド   |
| 詳細               | 実装内容<br>- 機能A<br>- 機能B |
```

# Wiki のエクスポート

`wiki`コマンドを使用すると、Backlog の Wiki ページを Markdown ファイルとしてエクスポートできます。

**基本的な使用方法**

```sh
$ backlog-exporter wiki --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
```

**出力先を指定**

```sh
$ backlog-exporter wiki --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./wiki
```

エクスポートされた Wiki は、指定したディレクトリ内に Markdown ファイルとして保存されます。Wiki の階層構造は保持され、ディレクトリ構造として再現されます。

# ドキュメント のエクスポート

`document`コマンドを使用すると、Backlog のドキュメントページを Markdown ファイルとしてエクスポートできます。

**基本的な使用方法**

```sh
$ backlog-exporter document --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
```

**出力先を指定**

```sh
$ backlog-exporter document --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./documents
```

**キーワード検索**

```sh
$ backlog-exporter document --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --keyword 仕様書
```

## ドキュメントの出力方法

ドキュメントは **ツリー構造を保持** してエクスポートされます：

### ディレクトリ構造の保持

- Backlogのドキュメントツリーの階層構造がそのままローカルディレクトリ構造として再現されます
- フォルダはディレクトリとして作成され、ドキュメントはMarkdownファイルとして保存されます
- 子を持つ親ドキュメント自身が本文を持つ場合は、フォルダ内の `00_index.md` として保存されます（本文が空の親はファイルを作成しません）

### 出力例

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

### 特徴

- **階層構造の完全再現**: Backlogのフォルダ階層がそのまま保持されます
- **親ドキュメント本文の保存**: 子を持つ親ドキュメントの本文もフォルダ内の `00_index.md` として保存されます
- **重複処理の防止**: 同じドキュメントが複数回処理されることを防ぎます
- **ファイル名の自動サニタイズ**: 不正な文字を自動的に除去して安全なファイル名を生成します
- **メタデータの保持**: 作成者、更新者、タグ、添付ファイル情報なども含めて保存されます

エクスポートされたドキュメントは、指定したディレクトリ内にツリー構造を保持したMarkdownファイルとして保存されます。

# 課題・Wiki・ドキュメント の一括エクスポート

`all`コマンドを使用すると、課題・Wiki・ドキュメントを一度に取得できます。

**基本的な使用方法**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY
```

**出力先を指定**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --output ./backlog-data
```

**特定のデータタイプのみをエクスポート（onlyフラグ）**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --only issues,wiki
```

**特定のデータタイプを除外してエクスポート（excludeフラグ）**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --apiKey YOUR_API_KEY --exclude documents
```

一括エクスポートでは、課題は`issues`ディレクトリに、Wiki は`wiki`ディレクトリに、ドキュメントは`documents`ディレクトリに保存されます。

## エクスポート対象の制御

`--only` / `--exclude` を指定せずに対話端末で実行した場合は、Wiki・ドキュメントのどちらを取得するかを選択できます（BacklogはWikiからドキュメントへの移行を予定しています）:

```
BacklogのWikiとドキュメントのどちらを取得しますか？（BacklogはWikiからドキュメントへの移行を予定しています）
  [1] 両方（デフォルト）  [2] Wikiのみ  [3] ドキュメントのみ
```

非対話環境（CI・パイプ実行）では従来どおり両方を取得します。

`all`コマンドでは、以下のフラグを使用してエクスポート対象を制御できます：

### --only フラグ

特定のデータタイプのみをエクスポートします。カンマ区切りで複数指定可能です。

**課題とWikiのみをエクスポート**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --only issues,wiki
```

**ドキュメントのみをエクスポート**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --only documents
```

### --exclude フラグ

特定のデータタイプを除外してエクスポートします。カンマ区切りで複数指定可能です。

**ドキュメント以外（課題とWiki）をエクスポート**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --exclude documents
```

**課題以外（WikiとDocuments）をエクスポート**

```sh
$ backlog-exporter all --domain example.backlog.jp --projectIdOrKey PROJECT_KEY --exclude issues
```

**注意**: `--only`と`--exclude`フラグは同時に使用できません。どちらか一方を使用してください。

# データの更新

`update`コマンドを使用すると、既存のエクスポートデータを最新の状態に更新できます。このコマンドは、ディレクトリ内の`backlog-settings.json`ファイルを探索し、見つかったディレクトリでデータを更新します。

**カレントディレクトリとそのサブディレクトリのデータを更新**

```sh
$ backlog-exporter update
```

**指定したディレクトリとそのサブディレクトリのデータを更新**

```sh
$ backlog-exporter update ./my-project
```

**確認プロンプトをスキップして更新**

```sh
$ backlog-exporter update --force
```

**課題のみを更新**

```sh
$ backlog-exporter update --issuesOnly
```

**Wikiのみを更新**

```sh
$ backlog-exporter update --wikisOnly
```

**ドキュメントのみを更新**

```sh
$ backlog-exporter update --documentsOnly
```

**APIキーを指定して更新**

```sh
$ backlog-exporter update --apiKey YOUR_API_KEY
```

**指定した項目（課題・Wiki・ドキュメント）のみを再取得する**

```sh
# 特定の課題だけを再取得（課題キーまたは課題ID）
$ backlog-exporter update --issueIdOrKey PROJECT-1,PROJECT-2

# 特定のWikiだけを再取得（Wiki ID）
$ backlog-exporter update --wikiId 12345,12346

# 特定のドキュメントだけを再取得（ドキュメントID）
$ backlog-exporter update --documentId abc123,def456
```

`update` は通常、設定ファイルの最終更新日時（`lastUpdated`）以降に更新された項目を差分取得します。一方で「特定の項目だけを取り直したい」場合は、上記のID指定フラグを使います。

- `--issueIdOrKey`: 課題キー（`PROJECT-1`）または課題ID（数値）。Wiki・ドキュメントは数値IDのみのため `--wikiId` / `--documentId` を使います
- いずれもカンマ区切りで複数指定できます
- 指定したフラグに対応する項目のみを再取得し、それ以外の種別の更新は行いません（例: `--wikiId` のみ指定時は課題・ドキュメントを更新しません）
- 指定した項目以外のローカルファイルには影響しません

> **Note**: これらのID指定フラグは全件差分更新ではないため、設定ファイルの最終更新日時（`lastUpdated`）は更新されません。そのため、次回の通常の差分更新に影響を与えません。

更新コマンドは、各ディレクトリの設定ファイルに基づいて、課題・Wiki・ドキュメントを自動的に更新します。設定ファイルが見つかったディレクトリでは、そのディレクトリ内のファイルが直接更新されます（サブフォルダは作成されません）。

**Backlog上で削除・移動された課題・ドキュメント・Wikiのローカルファイルを削除する（prune）**

```sh
# カレントディレクトリ配下の設定ファイルを探索して実行
$ backlog-exporter prune

# 対象ディレクトリを指定
$ backlog-exporter prune ./backlog-documents

# 確認プロンプトをスキップ
$ backlog-exporter prune --force
```

`update`（および各取得コマンド）は増分更新（追加・上書き）のため、Backlog上で削除された課題・ドキュメント・Wikiや別の場所へ移動されたものは、ローカルにファイルが残り続けます。`prune` コマンドは、Backlogに存在しないローカルの `.md` ファイルと、空になったディレクトリを削除してBacklogと同じ状態に揃えます。

- 対象は**課題・ドキュメント・Wikiフォルダ**です（設定ファイルの `folderType` で判定します）
- ファイルを削除する破壊的な操作のため、`update` とは独立したコマンドとして分離しています（実行時に確認プロンプトを表示。`--force` でスキップ可能）
- 削除対象は `.md` ファイルのみ。`backlog-settings.json`・`backlog-update.log`・`.md` 以外のファイルには触れません。ただし、対象フォルダ内にユーザーが独自に置いた `.md` ファイルや空のディレクトリは、Backlog上に存在しないものとして削除されるため注意してください
- ファイル名は保存時と同じロジックで比較します（ドキュメントは一覧APIの `title` 基準、課題は設定ファイルの `issueKeyFileName`/`issueKeyFolder` を反映）。サニタイズ差異やツリー名との差異による誤削除は起きません。ドキュメント情報の取得に失敗した場合は、誤削除を防ぐため何も削除せずに中止します
- 削除したファイルは `backlog-update.log` に記録されます

# コマンド

## `backlog-exporter help [COMMAND]`

Display help for backlog-exporter.

```
USAGE
  $ backlog-exporter help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for backlog-exporter.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.26/src/commands/help.ts)_

## `backlog-exporter plugins`

List installed plugins.

```
USAGE
  $ backlog-exporter plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ backlog-exporter plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/index.ts)_

## `backlog-exporter plugins add PLUGIN`

Installs a plugin into backlog-exporter.

```
USAGE
  $ backlog-exporter plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into backlog-exporter.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the BACKLOG_EXPORTER_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the BACKLOG_EXPORTER_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ backlog-exporter plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ backlog-exporter plugins add myplugin

  Install a plugin from a github url.

    $ backlog-exporter plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ backlog-exporter plugins add someuser/someplugin
```

## `backlog-exporter plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ backlog-exporter plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ backlog-exporter plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/inspect.ts)_

## `backlog-exporter plugins install PLUGIN`

Installs a plugin into backlog-exporter.

```
USAGE
  $ backlog-exporter plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into backlog-exporter.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the BACKLOG_EXPORTER_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the BACKLOG_EXPORTER_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ backlog-exporter plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ backlog-exporter plugins install myplugin

  Install a plugin from a github url.

    $ backlog-exporter plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ backlog-exporter plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/install.ts)_

## `backlog-exporter plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ backlog-exporter plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ backlog-exporter plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/link.ts)_

## `backlog-exporter plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ backlog-exporter plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ backlog-exporter plugins unlink
  $ backlog-exporter plugins remove

EXAMPLES
  $ backlog-exporter plugins remove myplugin
```

## `backlog-exporter plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ backlog-exporter plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/reset.ts)_

## `backlog-exporter plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ backlog-exporter plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ backlog-exporter plugins unlink
  $ backlog-exporter plugins remove

EXAMPLES
  $ backlog-exporter plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/uninstall.ts)_

## `backlog-exporter plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ backlog-exporter plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ backlog-exporter plugins unlink
  $ backlog-exporter plugins remove

EXAMPLES
  $ backlog-exporter plugins unlink myplugin
```

## `backlog-exporter plugins update`

Update installed plugins.

```
USAGE
  $ backlog-exporter plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.34/src/commands/plugins/update.ts)_

<!-- commandsstop -->

# 出力形式

## 本文マーカー

課題の詳細・Wikiの本文・ドキュメントの内容といった「本文」部分は、種別を問わず以下のHTMLコメントマーカーで囲まれて出力されます。

```markdown
<!-- backlog-exporter:body:start -->
ここが本文（## 見出しなどを含んでもよい）
<!-- backlog-exporter:body:end -->
```

- マーカーはMarkdownのレンダリング時には表示されません（HTMLコメント）
- 本文自体が `##` 見出しなどを含んでいても、開始・終了マーカー間を本文として機械的に抽出・差し替えできます
- 本文をBacklogへ書き戻す（API反映する）ツールなどが、どこからどこまでが本文かを一意に判定するために使えます
- 子を持つ親ドキュメントの本文（`00_index.md`）にも同じマーカーが付きます

**抽出時の規約**: 本文自体がマーカーと同じ文字列を含む可能性があるため（例: このツールの使い方をBacklog上にメモした場合）、抽出ツールは「ファイル内で**最初に現れる開始マーカー**から**最後に現れる終了マーカー**まで」を本文とみなしてください。

以降の出力例では、この本文マーカーを含めた形を示します。

## 課題の出力形式

課題は以下の形式で Markdown ファイルとして保存されます：

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
| 工数（PPO）        | なし                           |
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

---

### コメント 2

- **投稿者**: 鈴木三郎
- **日時**: 2023/01/02 09:45:12

返信コメントの内容がここに表示されます。
```

## Wiki の出力形式

Wiki は以下の形式で Markdown ファイルとして保存されます：

```markdown
# Wiki のタイトル

[Backlog Wiki Link](https://example.backlog.jp/alias/wiki/12345)

<!-- backlog-exporter:body:start -->
ここに Wiki の本文内容が入ります。
Backlog の書式がそのまま保持されます。
<!-- backlog-exporter:body:end -->
```

## ドキュメント の出力形式

ドキュメントは以下の形式で Markdown ファイルとして保存されます：

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
- **画像.png** (256.3 KB) - 作成者: 佐藤次郎, 作成日時: 2023/01/01 10:30:00

## タグ

- 仕様書
- 設計書
```

# その他の特徴

- **環境変数サポート**: 環境変数 `BACKLOG_API_KEY` を使用して API キーを設定可能
- **自動ディレクトリ作成**: 出力ディレクトリが存在しない場合は自動的に作成
- **並列処理**: 並列処理による高速なダウンロード
- **ファイル名サニタイズ**: ファイル名の自動サニタイズ（不正な文字の除去）
- **階層構造の保持**: Wiki の階層構造を保持したエクスポート
- **キーワード検索**: ドキュメントの検索キーワード対応
- **差分更新**: 前回の更新以降に変更されたデータのみを更新
- **カスタム属性対応**: 課題のカスタム属性をテーブル形式で表示（配列・オブジェクト・プリミティブ値に対応）

## 開発への貢献

backlog-exporterはオープンソースプロジェクトです。バグ報告、機能提案、プルリクエストなど、あらゆる形での貢献を歓迎しています。

詳しくは [CONTRIBUTING.md](docs/CONTRIBUTING.md) をご覧ください。

## ライセンス

このプロジェクトは[MIT License](LICENSE)の下で公開されています。
