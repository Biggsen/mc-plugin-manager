const { app, BrowserWindow } = require('electron')
const { join } = require('path')
const ipc = require('./ipc')
const storage = require('./storage')

let mainWindow: any = null

function createWindow() {
  const iconPath = join(__dirname, '../build/icon.png')
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Load the app
  // In development, try to load from Vite dev server
  // Check if we should use dev server (default to true for development)
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5176')
    mainWindow.webContents.openDevTools()
    
    // If dev server isn't ready, wait a bit and try again
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('Failed to load from dev server, will retry...')
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:5176')
      }, 1000)
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Initialize data directory
  await storage.initDataDirectory()
  
  // Setup IPC handlers (handlers are registered via ipcMain.handle in ipc.ts)
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
