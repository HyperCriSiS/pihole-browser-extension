import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const artifactDirectory = 'artifacts'
const artifacts = [
  {
    destination: `pihole-browser-extension-${packageJson.version}-firefox-unsigned.xpi`,
    source: 'package.firefox.zip',
  },
  {
    destination: `pihole-browser-extension-${packageJson.version}-chrome.zip`,
    source: 'package.chrome.zip',
  },
]

await rm(artifactDirectory, { force: true, recursive: true })
await mkdir(artifactDirectory, { recursive: true })

const checksumLines = []
for (const artifact of artifacts) {
  const destinationPath = path.join(artifactDirectory, artifact.destination)
  await copyFile(artifact.source, destinationPath)
  const checksum = createHash('sha256')
    .update(await readFile(destinationPath))
    .digest('hex')
  checksumLines.push(`${checksum}  ${artifact.destination}`)
}

await writeFile(
  path.join(artifactDirectory, 'SHA256SUMS.txt'),
  `${checksumLines.sort().join('\n')}\n`,
)

console.log(`Prepared release artifacts for version ${packageJson.version}.`)
