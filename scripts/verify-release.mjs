import { readFile } from 'node:fs/promises'

const tag = process.argv[2]
if (!tag) {
  throw new Error(
    'Expected a release tag argument, for example v4.2.0 or v4.2.0-rc.1.',
  )
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const firefoxManifest = JSON.parse(
  await readFile('manifest.firefox.json', 'utf8'),
)
const chromeManifest = JSON.parse(
  await readFile('manifest.chrome.json', 'utf8'),
)

const stableTag = `v${packageJson.version}`
const prereleasePattern = new RegExp(
  `^${escapeRegExp(stableTag)}-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*$`,
)

if (tag !== stableTag && !prereleasePattern.test(tag)) {
  throw new Error(
    `release tag mismatch: expected ${stableTag} or a prerelease such as ${stableTag}-rc.1, received ${tag}`,
  )
}

assertEqual(firefoxManifest.version, packageJson.version, 'Firefox version')
assertEqual(chromeManifest.version, packageJson.version, 'Chrome version')

console.log(`Release versions are consistent for ${tag}.`)

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${String(expected)}, received ${String(actual)}`,
    )
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
