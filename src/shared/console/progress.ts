import process from 'node:process'

export function writeProgress(message: string): void {
  process.stdout.write(`\r${message}`)
}
