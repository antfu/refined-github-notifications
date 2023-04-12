import fs from 'node:fs/promises'

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'))
const content = await fs.readFile('index.js', 'utf8')
const newContent = content.replace(/\/\/ @version\s+.*$/m, `// @version      ${version}`)
await fs.writeFile('index.js', newContent, 'utf8')
