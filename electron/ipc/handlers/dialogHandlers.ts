const { ipcMain, dialog, shell } = require('electron')

export function registerDialogHandlers(): void {
  ipcMain.handle(
    'show-import-dialog',
    async (_event: unknown): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Select Region Forge Export File',
        filters: [
          { name: 'YAML Files', extensions: ['yml', 'yaml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    'show-config-file-dialog',
    async (_event: unknown, title: string, defaultPath?: string): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title,
        defaultPath,
        filters: [
          { name: 'YAML Files', extensions: ['yml', 'yaml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    'show-output-dialog',
    async (_event: unknown): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Select Output Directory',
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    'show-folder-dialog',
    async (_event: unknown, title: string, defaultPath?: string): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title: title || 'Select Folder',
        defaultPath,
        properties: ['openDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    'open-path-in-explorer',
    async (_event: unknown, path: string): Promise<{ success: boolean; error?: string }> => {
      const trimmed = typeof path === 'string' ? path.trim() : ''
      if (!trimmed) {
        return { success: false, error: 'No path to open' }
      }
      const err = await shell.openPath(trimmed)
      if (err) {
        return { success: false, error: err }
      }
      return { success: true }
    }
  )
}
