
Error.stackTraceLimit = Infinity
import setupDebugLogger from './background-process/debug-logger'

// This is main process of Electron, started as first thing when your
// app starts. This script is running through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import { app, protocol } from 'electron'

import * as beakerBrowser from './background-process/browser'
import * as webAPIs from './background-process/web-apis'
import * as adblocker from './background-process/adblocker'

import * as windows from './background-process/ui/windows'
import * as windowMenu from './background-process/ui/window-menu'
import registerContextMenu from './background-process/ui/context-menu'
import * as downloads from './background-process/ui/downloads'
import * as permissions from './background-process/ui/permissions'
import * as basicAuth from './background-process/ui/basic-auth'

import * as archives from './background-process/dbs/archives'
import * as settings from './background-process/dbs/settings'
import * as sitedata from './background-process/dbs/sitedata'
import * as profileDataDb from './background-process/dbs/profile-data-db'
import * as bookmarksDb from './background-process/dbs/bookmarks'

import * as beakerProtocol from './background-process/protocols/beaker'
import * as beakerFaviconProtocol from './background-process/protocols/beaker-favicon'
import * as datProtocol from './background-process/protocols/dat'
import * as workspaceProtocol from './background-process/protocols/workspace'

// import * as profilesIngest from './background-process/ingests/profiles' TODO(profiles) disabled -prf

import * as testDriver from './background-process/test-driver'
import * as openURL from './background-process/open-url'


if (process.env.DOCKER_CLI_APP) {
  require("./background-process/web-apis/docker.cli.app/index.js");
} else {

// read config from env vars
setupDebugLogger()
if (process.env.beaker_user_data_path) {
  console.log('User data path set by environment variables')
  console.log('userData:', process.env.beaker_user_data_path)
  app.setPath('userData', process.env.beaker_user_data_path)
}
if (process.env.BEAKER_TEST_DRIVER) {
  testDriver.setup()
}
if (process.env.beaker_open_url) {
  openURL.open(process.env.beaker_open_url)
}

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
})

// configure the protocols
protocol.registerStandardSchemes(['dat', 'beaker', 'workspace'], { secure: true })

// handle OS event to open URLs
app.on('open-url', (e, url) => {
  e.preventDefault() // we are handling it
  // wait for ready (not waiting can trigger errors)
  if (app.isReady()) openURL.open(url)
  else app.on('ready', () => openURL.open(url))
})

app.on('ready', async function () {
  // databases
  profileDataDb.setup()
  archives.setup()
  settings.setup()
  sitedata.setup()
  // TEMP can probably remove this in 2018 or so -prf
  bookmarksDb.fixOldBookmarks()

  // base
  beakerBrowser.setup()
  adblocker.setup()

  // ui
  windowMenu.setup()
  registerContextMenu()
  windows.setup()
  downloads.setup()
  permissions.setup()
  basicAuth.setup()

  // protocols
  beakerProtocol.setup()
  beakerFaviconProtocol.setup()
  datProtocol.setup()
  workspaceProtocol.setup()

  // configure chromium's permissions for the protocols
  protocol.registerServiceWorkerSchemes(['dat', 'workspace'])

  // web APIs
  webAPIs.setup()

  // ingests
  // await profilesIngest.setup() TODO(profiles) disabled -prf
})

// only run one instance
const isSecondInstance = app.makeSingleInstance((argv, workingDirectory) => {
  handleArgv(argv)

  // focus/create a window
  windows.ensureOneWindowExists()
  windows.getActiveWindow().focus()
})
if (isSecondInstance) {
  app.exit()
} else {
  handleArgv(process.argv)
}
function handleArgv (argv) {
  if (process.platform !== 'darwin') {
    // look for URLs, windows & linux use argv instead of open-url
    let url = argv.find(v => v.indexOf('://') !== -1)
    if (url) {
      openURL.open(url)
    }
  }
}

}
