const fs = require('fs')
const path = require('path')

// Source directory
const sourceDir = path.join(__dirname, '..', 'reference', 'plugin config files', 'to be bundled')
// Target directory
const targetDir = path.join(__dirname, '..', 'dist-electron', 'assets', 'templates')

// Template files to copy
const templates = [
  'advancedachievements-config.yml',
  'commandwhitelist-config.yml',
  'conditionalevents-config.yml',
  'levelledmobs-rules.yml',
  'mycommand-commands.yml',
  'tab-config.yml'
]

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

console.log(`Successfully copied ${copiedCount} template files to ${targetDir}`)
