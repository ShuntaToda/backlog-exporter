# 開発ガイド

このドキュメントでは、backlog-exporterの開発環境のセットアップ方法と開発プロセスについて説明します。

## 目次

- [開発環境のセットアップ](#開発環境のセットアップ)
  - [前提条件](#前提条件)
  - [リポジトリのクローン](#リポジトリのクローン)
  - [依存関係のインストール](#依存関係のインストール)
  - [環境変数の設定](#環境変数の設定)
- [開発用コマンド](#開発用コマンド)
  - [ビルド](#ビルド)
  - [テスト](#テスト)
  - [リント](#リント)
  - [フォーマット](#フォーマット)
  - [開発サーバー](#開発サーバー)
- [デバッグ方法](#デバッグ方法)
  - [VSCodeでのデバッグ](#vscodeでのデバッグ)
  - [コンソールデバッグ](#コンソールデバッグ)
  - [テストのデバッグ](#テストのデバッグ)
- [トラブルシューティング](#トラブルシューティング)
  - [よくある問題と解決策](#よくある問題と解決策)
  - [エラーログの確認方法](#エラーログの確認方法)

## 開発環境のセットアップ

### 前提条件

backlog-exporterの開発には以下のソフトウェアが必要です：

- **Node.js**: バージョン18.0.0以上
  - [Node.js公式サイト](https://nodejs.org/)からダウンロードしてインストール
  - または[nvm](https://github.com/nvm-sh/nvm)を使用して管理することを推奨
  ```bash
  # nvmを使用してNode.jsをインストール
  nvm install 18
  nvm use 18
  ```

- **npm**: Node.jsに同梱されています
  - バージョン確認: `npm -v`
  - 最新版へのアップデート: `npm install -g npm@latest`

- **Git**: 最新版を推奨
  - [Git公式サイト](https://git-scm.com/)からダウンロードしてインストール
  - 基本設定
  ```bash
  git config --global user.name "あなたの名前"
  git config --global user.email "あなたのメールアドレス"
  ```

### リポジトリのクローン

1. GitHubでリポジトリをフォーク
   - [backlog-exporter](https://github.com/ShuntaToda/backlog-exporter)リポジトリにアクセス
   - 右上の「Fork」ボタンをクリック

2. フォークしたリポジトリをローカルにクローン
   ```bash
   git clone https://github.com/YOUR_USERNAME/backlog-exporter.git
   cd backlog-exporter
   ```

3. 上流リポジトリを追加
   ```bash
   git remote add upstream https://github.com/ShuntaToda/backlog-exporter.git
   ```

### 依存関係のインストール

プロジェクトディレクトリで以下のコマンドを実行して、必要な依存関係をインストールします：

```bash
npm install
```

このコマンドは`package.json`に記載されている全ての依存パッケージをインストールします。

### 環境変数の設定

1. `.env.example`ファイルをコピーして`.env`ファイルを作成
   ```bash
   cp .env.example .env
   ```

2. `.env`ファイルを編集して、必要な環境変数を設定
   ```
   BACKLOG_API_KEY=あなたのBacklog APIキー
   BACKLOG_SPACE_ID=あなたのBacklogスペースID
   ```

## 開発用コマンド

### ビルド

TypeScriptコードをJavaScriptにコンパイルします：

```bash
# 標準ビルド
npm run build

# 開発モードでビルド（ソースマップ付き）
npm run build:dev

# ビルドとウォッチ（変更を監視して自動ビルド）
npm run build:watch
```

ビルド出力は`dist/`ディレクトリに生成されます。

### テスト

Mochaを使用したテストを実行します：

```bash
# 全てのテストを実行
npm test

# 特定のテストファイルのみ実行
npm test -- --grep "テスト名"

# カバレッジレポート付きでテスト実行
npm test -- --coverage

# 継続的にテストを実行（ウォッチモード）
npm test -- --watch
```

テストファイルは`test/`ディレクトリに配置されています。

### リント

ESLintを使用してコードの品質チェックを行います：

```bash
# リント実行
npm run lint

# 自動修正可能な問題を修正
npm run lint -- --fix

# 特定のファイルのみリント
npm run lint -- src/commands/issue/index.ts
```

リントの設定は`.eslintrc.json`で管理されています。

### フォーマット

Prettierを使用してコードのフォーマットを行います：

```bash
# フォーマットチェック（変更なし）
npm run format:check

# フォーマット適用
npm run format

# 特定のファイルのみフォーマット
npx prettier --write "src/commands/issue/index.ts"
```

フォーマットの設定は`.prettierrc.json`で管理されています。

### 開発サーバー

ローカルでCLIを実行してテストします：

```bash
# ビルド後のCLIを実行
node ./bin/run.js

# 特定のコマンドを実行
node ./bin/run.js issue --projectKey PROJ

# 開発中のコードを直接実行（ts-node使用）
npx ts-node src/index.ts issue --projectKey PROJ
```

## デバッグ方法

### VSCodeでのデバッグ

VSCodeでデバッグするための設定ファイル`.vscode/launch.json`が用意されています：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current File",
      "program": "${file}",
      "preLaunchTask": "npm: build",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/bin/run.js",
      "args": ["issue", "--projectKey", "PROJ"],
      "preLaunchTask": "npm: build",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

使用方法：
1. VSCodeの「実行とデバッグ」パネルを開く
2. 「Debug CLI」または「Debug Current File」を選択
3. F5キーを押してデバッグを開始

### コンソールデバッグ

コード内にデバッグ情報を出力する方法：

```typescript
// 標準的なコンソール出力
console.log('デバッグ情報:', 変数);

// 詳細なオブジェクト情報
console.dir(オブジェクト, { depth: null, colors: true });

// エラー情報
console.error('エラー発生:', エラー);

// パフォーマンス計測
console.time('処理名');
// 処理
console.timeEnd('処理名');
```

プロジェクトには`src/utils/log.ts`にロガーが実装されています：

```typescript
import { log } from '../utils/log';

// 情報ログ
log.info('情報メッセージ');

// 警告ログ
log.warn('警告メッセージ');

// エラーログ
log.error('エラーメッセージ');

// デバッグログ（DEBUG環境変数が設定されている場合のみ出力）
log.debug('デバッグ情報');
```

デバッグログを有効にするには：

```bash
# Linuxまたは macOS
DEBUG=* node ./bin/run.js

# Windows
set DEBUG=* && node ./bin/run.js
```

### テストのデバッグ

テスト実行時のデバッグ方法：

```bash
# テスト実行時に詳細なログを出力
npm test -- --reporter spec

# 特定のテストのみ実行
npm test -- --grep "テスト名" --reporter spec

# Node.jsのインスペクタを使用したデバッグ
node --inspect-brk ./node_modules/.bin/mocha
```

VSCodeでテストをデバッグする場合は、`.vscode/launch.json`に以下の設定を追加：

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
  "args": [
    "--timeout",
    "999999",
    "--colors",
    "${workspaceFolder}/test/**/*.test.ts"
  ],
  "preLaunchTask": "npm: build",
  "sourceMaps": true,
  "outFiles": ["${workspaceFolder}/dist/**/*.js"]
}
```

## トラブルシューティング

### よくある問題と解決策

#### 1. 依存関係のインストールエラー

**症状**: `npm install`実行時にエラーが発生する

**解決策**:
```bash
# npmキャッシュのクリア
npm cache clean --force

# package-lock.jsonを削除して再インストール
rm package-lock.json
npm install
```

#### 2. TypeScriptコンパイルエラー

**症状**: `npm run build`実行時に型エラーが発生する

**解決策**:
```bash
# TypeScriptバージョンの確認
npx tsc --version

# 型定義の問題を詳細に確認
npx tsc --noEmit
```

#### 3. テスト失敗

**症状**: `npm test`実行時にテストが失敗する

**解決策**:
```bash
# 特定のテストのみ実行して詳細を確認
npm test -- --grep "失敗するテスト名" --reporter spec

# モックやスタブの設定を確認
# テストファイルの依存関係を確認
```

#### 4. ローカル実行時のエラー

**症状**: `node ./bin/run.js`実行時にエラーが発生する

**解決策**:
```bash
# 環境変数が正しく設定されているか確認
cat .env

# 最新のビルドを実行
npm run build

# デバッグモードで実行
DEBUG=* node ./bin/run.js
```

### エラーログの確認方法

#### システムログの確認

```bash
# Linuxの場合
journalctl -f

# macOSの場合
log stream --predicate 'eventMessage contains "node"'
```

#### アプリケーションログの確認

アプリケーションは`~/.backlog-exporter/logs/`ディレクトリにログを出力します：

```bash
# 最新のログファイルを表示
cat ~/.backlog-exporter/logs/latest.log

# エラーログを検索
grep ERROR ~/.backlog-exporter/logs/latest.log
```

#### デバッグモードの有効化

詳細なデバッグ情報を出力するには：

```bash
# 環境変数DEBUGを設定して実行
DEBUG=backlog-exporter:* node ./bin/run.js

# 全てのデバッグ情報を出力
DEBUG=* node ./bin/run.js
```

## 高度な開発トピック

### パフォーマンスプロファイリング

Node.jsの組み込みプロファイラーを使用：

```bash
# CPUプロファイリング
node --prof ./bin/run.js issue --projectKey PROJ

# プロファイル結果の処理
node --prof-process isolate-*.log > profile.txt
```

### メモリリーク検出

```bash
# メモリ使用量の監視
node --inspect ./bin/run.js
# Chromeで chrome://inspect を開いてデバッガに接続
```

### コードカバレッジの向上

```bash
# カバレッジレポート生成
npm test -- --coverage

# HTMLレポートを確認
open coverage/lcov-report/index.html
```

### 継続的インテグレーション

GitHub Actionsの設定は`.github/workflows/`ディレクトリにあります。ローカルでワークフローをテストするには[act](https://github.com/nektos/act)を使用できます：

```bash
# GitHub Actionsをローカルで実行
act pull_request
```

## 参考リンク

- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Node.js公式ドキュメント](https://nodejs.org/en/docs/)
- [Mocha公式ドキュメント](https://mochajs.org/)
- [ESLint公式ドキュメント](https://eslint.org/docs/user-guide/)
- [Prettier公式ドキュメント](https://prettier.io/docs/en/)
- [oclif公式ドキュメント](https://oclif.io/docs/introduction)
