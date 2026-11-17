import process from 'node:process'

export function loadDotenv(): void {
  try {
    process.loadEnvFile()
  } catch {
    // .env が存在しない場合は何もしない
  }
}
