const fs = require('fs')
const path = require('path')

// Source directory
const sourceDir = path.join(__dirname, '..', 'reference', 'plugin config files', 'to be bundled')
// Target directory
const targetDir = path.join(__dirname, '..', 'dist-electron', 'assets', 'templates')
const dataSourceDir = path.join(__dirname, '..', 'reference', 'data')
const dataTargetDir = path.join(__dirname, '..', 'dist-electron', 'assets', 'data')
/** Single merged item catalog used by drop-table editor / builds (see electron/itemIndex.ts). */
const ITEM_INDEX_JSON = 'all.json'

// Old monolithic ipc.js in dist-electron shadows ipc/index.js when main uses require('./ipc').
const staleIpcJs = path.join(__dirname, '..', 'dist-electron', 'ipc.js')
if (fs.existsSync(staleIpcJs)) {
  fs.unlinkSync(staleIpcJs)
  console.log('Removed stale dist-electron/ipc.js (handlers live in dist-electron/ipc/)')
}

// Template files to copy
const templates = [
  'advancedachievements-config.yml',
  'commandwhitelist-config.yml',
  'conditionalevents-config.yml',
  'crazycrates-config.yml',
  'crazycrates-crates-HeartCrate.yml',
  'crazycrates-crates-RegionCrate.yml',
  'crazycrates-crates-VillageCrate.yml',
  'crazycrates-crate-base-template.yml',
  'discordsrv-config.yml',
  'discordsrv-messages.yml',
  'essentials-config.yml',
  'essentials-rules.txt',
  'griefprevention-config.yml',
  'levelledmobs-customdrops.yml',
  'levelledmobs-rules.yml',
  'mycommand-commands.yml',
  'tab-config.yml'
]

/** Copied byte-for-byte (no UTF-8 read / header strip). */
const binaryTemplates = ['perms-exploration.json.gz']

// Strip version headers from content
// Version headers are comment blocks that start with "# MC Plugin Manager" or similar patterns
// We'll strip consecutive comment lines at the start that match version header patterns
function stripVersionHeaders(content) {
  const lines = content.split('\n')
  let startIndex = 0
  
  // Find the first non-comment line or non-version-header comment line
  // Version headers typically start with "# MC Plugin Manager" or "# Target Plugin Version"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines
    if (line === '') {
      continue
    }
    
    // If it's a comment line that looks like a version header, skip it
    if (line.startsWith('#') && (
      line.includes('MC Plugin Manager') ||
      line.includes('Bundled Default Template') ||
      line.includes('Target Plugin Version') ||
      line.includes('Last Updated:') ||
      line.includes('This file serves as a template')
    )) {
      continue
    }
    
    // Found the start of actual content
    startIndex = i
    break
  }
  
  return lines.slice(startIndex).join('\n')
}

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy each template file
let copiedCount = 0
for (const template of templates) {
  const sourcePath = path.join(sourceDir, template)
  const targetPath = path.join(targetDir, template)
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Source file not found: ${sourcePath}`)
    process.exit(1)
  }
  
  // Read source file
  const content = fs.readFileSync(sourcePath, 'utf-8')
  
  // Strip version headers
  const cleanedContent = stripVersionHeaders(content)
  
  // Write to target
  fs.writeFileSync(targetPath, cleanedContent, 'utf-8')
  console.log(`Copied: ${template}`)
  copiedCount++
}

// Validate all files were copied
if (copiedCount !== templates.length) {
  console.error(`Error: Expected to copy ${templates.length} files, but only copied ${copiedCount}`)
  process.exit(1)
}

// Verify all target files exist
for (const template of templates) {
  const targetPath = path.join(targetDir, template)
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Target file was not created: ${targetPath}`)
    process.exit(1)
  }
}

let binaryCopiedCount = 0
for (const name of binaryTemplates) {
  const sourcePath = path.join(sourceDir, name)
  const targetPath = path.join(targetDir, name)
  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Source file not found: ${sourcePath}`)
    process.exit(1)
  }
  fs.copyFileSync(sourcePath, targetPath)
  console.log(`Copied (binary): ${name}`)
  binaryCopiedCount++
}
if (binaryCopiedCount !== binaryTemplates.length) {
  console.error(
    `Error: Expected to copy ${binaryTemplates.length} binary template(s), but copied ${binaryCopiedCount}`
  )
  process.exit(1)
}
for (const name of binaryTemplates) {
  const targetPath = path.join(targetDir, name)
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Binary target file was not created: ${targetPath}`)
    process.exit(1)
  }
}

// PlaceholderAPI plugin-shaped subtree: YAML stripped; other files (e.g. .jar) copied byte-for-byte
const placeholderApiSrc = path.join(sourceDir, 'PlaceholderAPI')
const placeholderApiDst = path.join(targetDir, 'PlaceholderAPI')
if (!fs.existsSync(placeholderApiSrc)) {
  console.error(`Error: PlaceholderAPI bundle folder not found: ${placeholderApiSrc}`)
  process.exit(1)
}
let placeholderApiFileCount = 0
function copyPlaceholderApiTree(srcDir, relPrefix) {
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, ent.name)
    const rel = relPrefix ? path.join(relPrefix, ent.name) : ent.name
    if (ent.isDirectory()) {
      copyPlaceholderApiTree(srcPath, rel)
    } else {
      const destPath = path.join(placeholderApiDst, rel)
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      const lower = ent.name.toLowerCase()
      if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
        const content = fs.readFileSync(srcPath, 'utf-8')
        fs.writeFileSync(destPath, stripVersionHeaders(content), 'utf-8')
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
      console.log(`Copied PlaceholderAPI: ${rel}`)
      placeholderApiFileCount++
    }
  }
}
copyPlaceholderApiTree(placeholderApiSrc, '')
if (placeholderApiFileCount === 0) {
  console.error('Error: PlaceholderAPI bundle folder contained no files')
  process.exit(1)
}

// Copy guide books (BookGUI) to dist-electron/assets/templates/guide-books
const guideBooksSourceDir = path.join(__dirname, '..', 'reference', 'plugin config files', 'guide books')
const guideBooksTargetDir = path.join(targetDir, 'guide-books')
if (fs.existsSync(guideBooksSourceDir)) {
  if (!fs.existsSync(guideBooksTargetDir)) {
    fs.mkdirSync(guideBooksTargetDir, { recursive: true })
  }
  const guideBookFiles = fs.readdirSync(guideBooksSourceDir).filter((f) => f.endsWith('.yml'))
  for (const file of guideBookFiles) {
    const src = path.join(guideBooksSourceDir, file)
    const dest = path.join(guideBooksTargetDir, file)
    fs.copyFileSync(src, dest)
    console.log(`Copied guide book: ${file}`)
  }
}

// Copy merged item index only (packaged app excludes reference/; see scripts/package-electron.js)
if (!fs.existsSync(dataTargetDir)) {
  fs.mkdirSync(dataTargetDir, { recursive: true })
} else {
  for (const f of fs.readdirSync(dataTargetDir)) {
    if (f.endsWith('.json') && f !== ITEM_INDEX_JSON) {
      fs.unlinkSync(path.join(dataTargetDir, f))
    }
  }
}
const itemIndexSrc = path.join(dataSourceDir, ITEM_INDEX_JSON)
const itemIndexDest = path.join(dataTargetDir, ITEM_INDEX_JSON)
if (!fs.existsSync(itemIndexSrc)) {
  console.error(`Error: Item index not found: ${itemIndexSrc}`)
  process.exit(1)
}
fs.copyFileSync(itemIndexSrc, itemIndexDest)
console.log(`Copied data file: ${ITEM_INDEX_JSON}`)

console.log(
  `Successfully copied ${copiedCount} text template(s) and ${binaryCopiedCount} binary file(s) to ${targetDir}`
)
