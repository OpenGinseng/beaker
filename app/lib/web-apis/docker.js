
import rpc from 'pauls-electron-rpc'
import errors from 'beaker-error-constants'
import dockerManifest from '../api-manifests/external/docker'
import {EventEmitter} from 'events'

const ipcRenderer = require('electron').ipcRenderer;



var workspaceContext = new Promise(function (resolve, reject) {
  setTimeout(function () {
    workspaceContext._resolve = resolve;
  }, 0);
});

ipcRenderer.on("plugins:workspace-context", (event, message) => {
  if (workspaceContext._resolve) {
    workspaceContext._resolve(message);
  }
  workspaceContext = message;
});

async function getWorkspaceContext () {
  if (workspaceContext.then) {
    return workspaceContext;
  }
  return Promise.resolve(workspaceContext);
}



// create the rpc api
const dockerRPC = rpc.importAPI('docker', dockerManifest, { timeout: false, errors })

export default class Docker extends EventEmitter {

  constructor (path, instanceName, opts = {}) {
    super();
    var self = this;
    self.context = {
      path: path,
      instanceName: instanceName,
      opts: opts
    };

    var eventStream = dockerRPC.getEventStream();
    eventStream.on("data", function (message) {

        console.log("[docker event]", message[0], message[1]);

        self.emit(message[0], message[1]);

        /*
        if (message[0] === "present") {
        if (message[0] === "started") {
        if (message[0] === "stopped") {
        if (message[0] === "destroyed") {
        if (message[0] === "fail") {
        */
    });

    (async function () {
      var workspaceContext = await getWorkspaceContext();
      dockerRPC.notifyDockerInstance(workspaceContext);
    })().catch(console.error);
  }

  async run (command) {
    var errStack = (new Error()).stack
    try {
      var workspaceContext = await getWorkspaceContext();
      var response = await dockerRPC.run(workspaceContext, this.context, command)
      return response
    } catch (e) {
      throwWithFixedStack(e, errStack)
    }
  }
  async stop () {
    var errStack = (new Error()).stack
    try {
      var workspaceContext = await getWorkspaceContext();
      var response = await dockerRPC.stop(workspaceContext, this.context)
      this.emit("stopped");
      return response
    } catch (e) {
      throwWithFixedStack(e, errStack)
    }
  }
}

function throwWithFixedStack (e, errStack) {
  e = e || new Error()
  e.stack = e.stack.split('\n')[0] + '\n' + errStack.split('\n').slice(2).join('\n')
  throw e
}
