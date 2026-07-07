// 通常はBacklogドメイン（example.backlog.jp）を https:// として扱う。
// テストのモックサーバやセルフホスト向けにプロトコル付き（http://127.0.0.1:8080 等）も許可する
export function backlogOrigin(domain: string): string {
  return /^https?:\/\//.test(domain) ? domain : `https://${domain}`
}
