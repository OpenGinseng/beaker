import { ipcRenderer } from 'electron'
import { setup as setupUI } from './shell-window/ui'
import DatArchive from './lib/web-apis/dat-archive'
import beaker from './lib/web-apis/beaker'
import plugins from './shell-window/plugins'

window.DatArchive = DatArchive
window.beaker = beaker
window.plugins = plugins;
setupUI(() => {
  plugins.init(window);
  ipcRenderer.send('shell-window:ready')
})
