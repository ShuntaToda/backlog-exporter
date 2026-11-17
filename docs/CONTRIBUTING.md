# Contributing to backlog-exporter

backlog-exporterへの貢献を歓迎します！

## 開発環境のセットアップ

### 前提条件

- Node.js 22以上
- npm
- Git

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/ShuntaToda/backlog-exporter.git
cd backlog-exporter

# 依存関係をインストール
npm install

# ビルド
npm run build

# テスト実行
npm test
```

### 開発コマンド

```bash
npm run build      # TypeScriptをビルド
npm run format     # コードフォーマット（.prettierignore に載せた既存のファイルは整えない）
npm run lint       # ESLint実行
npm run typecheck  # テスト・e2eを含めて型を確かめる
npm test           # テスト実行（終わるとlintも動く）
npm run test:e2e   # ビルドしたCLIをモックサーバーに向けて動かす
```

## プロジェクト構造と決まり

層の分け方・import の向き・道具で縛っている決まりは [development.md](development.md) にあります。AI のコーディングエージェント向けの約束は [AGENTS.md](../AGENTS.md) です。

`npm install` で lefthook の git hook が入り、コミットの前に整形と lint、コミットメッセージの形（1 行・AI の署名なし）、push の前に型とテストを確かめます。

## 貢献の方法

### バグ報告

[GitHub Issues](https://github.com/ShuntaToda/backlog-exporter/issues)でバグを報告してください。

以下の情報を含めてください：

- OS・Node.jsバージョン
- 再現手順
- 期待される動作と実際の動作
- エラーメッセージ

### 機能提案

新機能の提案もIssuesで受け付けています。

- 機能の説明
- 使用場面
- 実装案（もしあれば）

### プルリクエスト

1. リポジトリをフォーク
2. フィーチャーブランチを作成（`feature/your-feature`）
3. 実装とテストを追加
4. `npm test`ですべてのテストが通ることを確認
5. コミットメッセージは 1 行で書く（本文・`Co-Authored-By` などのトレーラーは付けない。CI が確かめる）
6. プルリクエストを作成（本文はテンプレートの「何を・なぜ」「確かめたこと」「黙らせた検査・残したこと」に沿って書く）

#### 注意事項

- ESLintとPrettierの設定に従ってください
- 新機能にはテストを追加してください
- エラーメッセージは日本語で記述してください

## テスト

```bash
# 全テスト実行
npm test

# 特定のテストファイル実行
npx vitest run src/modules/issue
```

## 技術仕様

- **言語**: TypeScript 5.x
- **ランタイム**: Node.js >=22.0.0
- **CLIフレームワーク**: oclif v4
- **HTTPクライアント**: Node.js 組み込みの fetch
- **テスト**: Vitest

## 質問・相談

- 使い方の質問: [GitHub Discussions](https://github.com/ShuntaToda/backlog-exporter/discussions)
- バグ報告・機能提案: [GitHub Issues](https://github.com/ShuntaToda/backlog-exporter/issues)

皆様の貢献をお待ちしています！
