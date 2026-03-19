# Locales

[i18next](https://www.i18next.com/) を使用した多言語対応のための翻訳ファイルを管理するディレクトリです。

## 対応言語

| ファイル  | 言語   |
| --------- | ------ |
| `ja.json` | 日本語 |
| `en.json` | 英語   |

## ネームスペース構造

```
├── commands/
│   ├── all/          # all コマンド
│   ├── issue/        # issue コマンド
│   ├── document/     # document コマンド
│   ├── wiki/         # wiki コマンド
│   └── update/       # update コマンド
│       ├── description   # コマンドの説明文
│       ├── examples/     # ヘルプに表示する使用例
│       ├── labels/       # エクスポートファイルに出力するラベル
│       ├── messages/     # 実行時のログ・エラーメッセージ
│       └── args/         # コマンド引数の説明（update のみ）
│
└── common/
    ├── flags/        # 複数コマンドで共有するCLIフラグの説明
    ├── labels/       # 複数コマンドで共有するエクスポート用ラベル
    └── messages/     # 複数コマンドで共有するログ・エラーメッセージ
```

## キーの配置基準

### `commands.<command>.*` vs `common.*`

- そのコマンドでしか使わないキーは `commands.<command>.*` に配置する
- 複数のコマンドで横断的に使われるキーは `common.*` に配置する

### サブカテゴリの使い分け

| カテゴリ   | 用途                                         | 例                               |
| ---------- | -------------------------------------------- | -------------------------------- |
| `labels`   | エクスポートされるファイルに出力するラベル文字列 | `status`, `createdAt`, `assignee` |
| `messages` | 実行時にコンソールに表示するメッセージ         | `fetchStart`, `completed`         |
| `examples` | `--help` に表示するコマンド使用例の説明        | `saveIssues`, `outputDir`         |
| `flags`    | CLIフラグの説明文                              | `apiKey`, `domain`                |

### キーを追加するときの判断フロー

1. そのキーは特定のコマンドでしか使わないか？
   - Yes → `commands.<command>` 配下に追加
   - No → `common` 配下に追加
2. キーの用途は何か？
   - エクスポートファイルのラベル → `labels`
   - 実行時メッセージ → `messages`
   - CLIフラグの説明 → `flags`
   - 使用例の説明 → `examples`
