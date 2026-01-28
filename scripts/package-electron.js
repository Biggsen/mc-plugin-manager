const packager = require('electron-packager')
const path = require('path')

async function packageApp() {
  const options = {
    dir: '.',
    platform: 'win32',
    arch: 'x64',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    out: path.join(__dirname, '..', 'release'),
    overwrite: true,
    // Custom ignore function that explicitly includes dist-electron
    ignore: (filePath) => {
      // Always include dist-electron and its contents
      if (filePath.startsWith('dist-electron')) {
        return false
      }
      // Always include dist and its contents
      if (filePath.startsWith('dist')) {
        return false
      }
      // Always include node_modules
      if (filePath.startsWith('node_modules')) {
        return false
      }
      // Always include package.json and index.html
      if (filePath === 'package.json' || filePath === 'index.html') {
        return false
      }
      // Exclude source directories
      if (filePath.startsWith('electron') || filePath.startsWith('src') || 
          filePath.startsWith('reference') || filePath.startsWith('tasks') ||
          filePath.startsWith('scripts') || filePath.startsWith('.git') ||
          filePath.startsWith('.vscode') || filePath.startsWith('.idea')) {
        return true
      }
      // Exclude TypeScript source files
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        return true
      }
      // Exclude config files
      if (filePath.includes('tsconfig') || filePath.includes('vite.config') ||
          filePath === '.gitignore' || filePath === 'README.md') {
        return true
      }
      // Include everything else by default
      return false
    }
  }

  try {
    const appPaths = await packager(options)
    console.log(`Electron app packaged to: ${appPaths.join(', ')}`)
  } catch (error) {
    console.error('Error packaging Electron app:', error)
    process.exit(1)
  }
}

packageApp()
