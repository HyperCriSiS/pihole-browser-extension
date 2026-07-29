import { rm } from 'node:fs/promises'

const generatedPaths = [
  'artifacts',
  'dist',
  'package.chrome.zip',
  'package.firefox.zip',
]

await Promise.all(
  generatedPaths.map((generatedPath) =>
    rm(generatedPath, { force: true, recursive: true }),
  ),
)
