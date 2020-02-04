
const {app} = require('electron')

import emitStream from 'emit-stream'
import {EventEmitter} from 'events'

const PATH = require("path");
const SPAWN = require("child_process").spawn;
const PromiseMap = require('promise-map');

const WINSTON = require("winston");


const logger = WINSTON.createLogger({
  level: 'silly',
  format: WINSTON.format.json(),
  transports: [
    new WINSTON.transports.File({
      filename: '/Users/cadorn/Desktop/docker-combined.log'
    })
  ]
});
logger.add(new WINSTON.transports.Console({
  format: WINSTON.format.simple()
}));


const console = {
  log: function () {
    logger.log({
      level: 'info',
      message: JSON.stringify(Array.from(arguments))
    });
  },
  error: function () {
    logger.log({
      level: 'error',
      message: JSON.stringify(Array.from(arguments))
    });
  }
};

const dockerCliApp = PATH.join(__dirname, "background-process/web-apis/docker.cli.app");

var dockerInstances = {};

var dockerEvents = new EventEmitter();



var monitorProcess = null;
function ensureElectronProcessMonitorStarted () {
  if (monitorProcess) {
    return null;
  }

  console.log("START Process monitor");              

  var env = process.env;
  env.ELECTON_BIN = app.getPath("exe");
  env.DOCKER_CLI_APP = dockerCliApp;
  env.PATH = env.PATH + ":/usr/local/bin";

  monitorProcess = SPAWN(app.getPath("exe"), [
    dockerCliApp,
    '--script', 'process-monitor',
    '--pid', process.pid
  ], {
    env: env,
    detached: true,
    stdio: [ 'ignore', 'pipe', 'pipe' ]
  });
  monitorProcess.on("error", function (err) {
    throw err;
  });
  //if (self.opts.debug) {
    monitorProcess.stdout.on("data", function (chunk) {
      console.log("[docker][process-monitor][stdout]", chunk.toString());
    });
    monitorProcess.stderr.on("data", function (chunk) {
      console.error("[docker][process-monitor][stderr]", chunk.toString());
    });
  //}
  monitorProcess.unref();
}


async function ensureDockerStarted (page, dockerContext, command) {
    if (
      !dockerInstances[page.id] ||
      !dockerInstances[page.id].instances[dockerContext.instanceName]
    ) {

        if (!dockerInstances[page.id]) {
          dockerInstances[page.id] = {
            instances: {}
          };
        }

        dockerInstances[page.id].instances[dockerContext.instanceName] = new Promise(function (resolve, reject) {
            // start docker

console.log("START DOCKER INSTANCE FOR: localFilesPath!", page, dockerContext);              

            if (!/^\//.test(dockerContext.path)) {
              throw new Error("Path to docker container must start with '/'!");
            }

            var env = process.env;
            var dockerControlPath = PATH.join(__dirname, "background-process/web-apis/docker.sh");

            console.log("[docker] Starting process for:", page.localFilesPath, dockerContext.path.replace(/\.\.\//g, "/"));

            console.log("[docker] dockerControlPath", dockerControlPath);

            env.ELECTON_BIN = app.getPath("exe");
            env.DOCKER_CLI_APP = dockerCliApp;
            env.PATH = env.PATH + ":/usr/local/bin";

            var instanceName = dockerContext.instanceName + "_" + page.id + "_" + process.pid;

            // TODO: Cache proc for given folder on browser so it persists across pages
            // TODO: Stop proc when leaving website
            var proc = SPAWN(dockerControlPath, [
                "run",
                "--appBasePath", __dirname,
                "--instance", instanceName,
                "--path", dockerContext.path.replace(/\.\.\//g, "/").replace(/^\//, ""),
                "--command", '"' + command.replace(/"/g, '\\"') + '"'
            ], {
              cwd: page.localFilesPath,
              env: env,
              stdio: [ 'ignore', 'pipe', 'pipe' ]
              // TODO: Set 'env.DEBUG' based on 'self.opts.debug'
            });
            proc.on("error", function (err) {
              throw err;
            });

            var stopping = false;
            proc.on("close", function (code) {
              console.log("[docker][run] Process ended with code '" + code + "' for:", page.localFilesPath, dockerContext.path.replace(/\.\.\//g, "/"));
              proc = null;

              delete dockerInstances[page.id].instances[dockerContext.instanceName];

              console.log("stopping", stopping);

              if (Object.keys(dockerInstances[page.id].instances).length === 0) {
                dockerInstances[page.id] = null;
                delete dockerInstances[page.id];
                dockerEvents.emit("destroyed", {
                    workspaceContext: page
                });
              }

              if (!stopping) {
                dockerEvents.emit("fail", {
                  workspaceContext: page,
                  message: "Docker process exited with code '" + code + "'."
                });
              }

            });

            var m;
            proc.stdout.on("data", function (chunk) {
              m = chunk.toString().match(/\[docker\]\[set\] (.+)\n/);
              if (m) {
                try {
                  m = JSON.parse(m[1]);
                } catch (err) {
                  console.error("Error parsing JSON:", m[1]);
                }
                var vars = {};
                Object.keys(m).forEach(function (name) {
                  vars[name] = m[name];
                });
                if (vars.HTTP_PORT) {

                  setTimeout(function() {

                    var eventPayload = {
                        workspaceContext: page,
                        dockerContext: dockerContext,
                        serverInfo: {
                            "protocol": "http:",
                            "hostname": "localhost",
                            "port": vars.HTTP_PORT,
                            "vars": vars
                        }
                    };
              
                    dockerEvents.emit("started", eventPayload);
        
                    resolve({
                        serverInfo: {
                            "protocol": "http:",
                            "hostname": "localhost",
                            "port": vars.HTTP_PORT,
                            "vars": vars
                        },
                        stop: function () {
            
            console.log("STOP DOCKER INSTANCE FOR: localFilesPath!", page.id, instanceName);
            console.log("dockerControlPath", dockerControlPath);
            
                            if (!eventPayload) {
                              throw new Error("Process is not running.");
                            }

                            stopping = true;
                      
                            var proc = SPAWN(dockerControlPath, [
                                "stop",
                                "--appBasePath", __dirname,
                                "--instance", instanceName
                            ], {
                              cwd: page.localFilesPath,
                              stdio: [
                                  'ignore',
                                  'pipe',
                                  'pipe'
                              ]
                              // TODO: Set 'env.DEBUG' based on 'self.opts.debug'
                            });
                            proc.on("error", function (err) {
                              throw err;
                            });
                      
                            // TODO: How can I access 'process.env.NODE_ENV' when 'process' is not available in this context?
                            //if (self.opts.debug) {
                              proc.stdout.on("data", function (chunk) {
                                console.log("[docker][stop][stdout]", chunk.toString());
                              });
                              proc.stderr.on("data", function (chunk) {
                                console.error("[docker][stop][stderr]", chunk.toString());
                              });
                            //}
            
                            // TODO: Wait for docker process to end
                            eventPayload = null;
                            return Promise.resolve(null);
                        }
                    });
                  }, 2000);

                }
              }
            });
      
            //if (self.opts.debug) {
              proc.stdout.on("data", function (chunk) {
                console.log("[docker][run][stdout]", chunk.toString());
              });
              proc.stderr.on("data", function (chunk) {
                console.error("[docker][run][stderr]", chunk.toString());
              });
            //}

            ensureElectronProcessMonitorStarted();

        });
    }
    return dockerInstances[page.id].instances[dockerContext.instanceName];
}

async function ensureDockerStopped (page) {
    if (!dockerInstances[page.id]) {
      return Promise.resolve(null);
    }
    return Promise.resolve(Object.keys(dockerInstances[page.id].instances)).then(PromiseMap(function (instanceName) {
        return dockerInstances[page.id].instances[instanceName].then(function (instanceInfo) {
            return instanceInfo.stop();
        });
    })).catch(function (err) {
        console.error("ERROR while stopping docker:", err);
        throw err;
    });
}


// exported api
// =

export default {
  async notifyDockerInstance (workspaceContext) {
    dockerEvents.emit("present");

    if (
      dockerInstances[workspaceContext.id] &&
      dockerInstances[workspaceContext.id].instances
    ) {
      Object.keys(dockerInstances[workspaceContext.id].instances).forEach(function (name) {

        dockerInstances[workspaceContext.id].instances[name].then(function (instance) {

          dockerEvents.emit("running", {
            workspaceContext: workspaceContext,
            serverInfo: instance.serverInfo
          });
        });
      });
    }

    return null;
  },
  async getEventStream () {
    return await emitStream(dockerEvents);
  },
  async removeWorkspace (workspaceContext) {
    return await ensureDockerStopped(workspaceContext);
  },
  async run (workspaceContext, dockerContext, command) {
    var response = await ensureDockerStarted(workspaceContext, dockerContext, command);
    return response.serverInfo;
  },
  async stop (workspaceContext, dockerContext) {
    return await ensureDockerStopped(workspaceContext);
  }
}

