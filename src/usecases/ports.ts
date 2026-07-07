/**
 * ユースケースがユーザー通知に使うロガー。
 * oclifのCommand（log/warn）を薄くラップして注入する。
 */
export interface Logger {
  log(message: string): void
  warn(message: string): void
}
