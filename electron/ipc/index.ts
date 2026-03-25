/**
 * Register all IPC handlers. Import this module from the main process to attach handlers.
 */
const { registerServerHandlers } = require('./handlers/serverHandlers')
const { registerImportHandlers } = require('./handlers/importHandlers')
const { registerBuildHandlers } = require('./handlers/buildHandlers')
const { registerLoreBookHandlers } = require('./handlers/loreBookHandlers')
const { registerDialogHandlers } = require('./handlers/dialogHandlers')
const { registerPluginCompareHandlers } = require('./handlers/pluginCompareHandlers')

function registerAllHandlers(): void {
  registerServerHandlers()
  registerImportHandlers()
  registerBuildHandlers()
  registerLoreBookHandlers()
  registerDialogHandlers()
  registerPluginCompareHandlers()
}

registerAllHandlers()
