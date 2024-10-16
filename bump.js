/* eslint-disable antfu/no-top-level-await */
import fs from 'node:fs/promises'

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'))
const content = await fs.readFile('index.js', 'utf8')
const newContent = content.replace(/\/\/ @version\s+(?:\S.*)?$/m, `// @version      ${version}`)
await fs.writeFile('index.js', newContent, 'utf8')
