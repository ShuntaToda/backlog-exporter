# Contributing to backlog-exporter

backlog-exporterへの貢献を歓迎します！

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
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
npm run format     # コードフォーマット
npm run lint       # ESLint実行
npm test           # テスト実行
```

## プロジェクト構造

```
src/
├── commands/          # CLIコマンド実装
│   ├── all/           # 一括エクスポート
│   ├── document/      # ドキュメントエクスポート
│   ├── issue/         # 課題エクスポート
│   ├── update/        # 更新
│   └── wiki/          # Wikiエクスポート
└── utils/             # ユーティリティ関数
```

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
5. プルリクエストを作成

#### 注意事項

- ESLintとPrettierの設定に従ってください
- 新機能にはテストを追加してください
- エラーメッセージは日本語で記述してください

## テスト

```bash
# 全テスト実行
npm test

# 特定のテストファイル実行
npm test -- --grep "test-pattern"
```

## 技術仕様

- **言語**: TypeScript 5.x
- **ランタイム**: Node.js >=18.0.0
- **CLIフレームワーク**: oclif v4
- **HTTPクライアント**: ky
- **テスト**: Mocha + Chai

## 質問・相談

- 使い方の質問: [GitHub Discussions](https://github.com/ShuntaToda/backlog-exporter/discussions)
- バグ報告・機能提案: [GitHub Issues](https://github.com/ShuntaToda/backlog-exporter/issues)

皆様の貢献をお待ちしています！
