
const PATH = require("path");
const SPAWN = require("child_process").spawn;

import {EventTarget, Event, fromEventStream} from './event-target'

class Docker extends EventTarget {
  constructor (path, opts = {}) {
    super()
    var errStack = (new Error()).stack
    try {

      if (!/^\//.test(path)) {
        throw new Error("Path to docker container must start with '/'!");
      }
      this.path = path

      this.opts = opts;

      this.proc = null;
      // TODO: Cache proc for given folder on browser so it persists across pages
      // TODO: Stop proc when leaving website

      // TODO: Derive path to current 'site' dynamically
      this.siteBasePath = "/dl/spaces/o/io.ginseng/beaker.sites/test";

      // TODO: Derive path to sibling control file at './docker.sh' dynamically
      this.dockerControlPath = "/dl/spaces/o/io.ginseng/beaker/app/lib/web-apis/docker.sh"
      
    } catch (e) {
      throwWithFixedStack(e, errStack)
    }
  }

  run (command) {
    var errStack = (new Error()).stack
    var self = this;
    try {

      if (self.proc) {

        if (self.opts.debug) {
          console.log("[docker][run] Skipping new run and returning existing instance for:", self.path);
        }

        setTimeout(function () {
          Object.keys(self.proc.docker).forEach(function (name) {
            self.proc.emit("docker." + name, self.proc.docker[name]);
          });
        }, 0);

        return self.proc;
      }

      if (self.opts.debug) {
        console.log("[docker] Starting process for:", self.path);
      }
    
      self.proc = SPAWN(self.dockerControlPath, [
          "run",
          "--path", self.path.replace(/^\//, ""),
          "--command", '"' + command.replace(/"/g, '\\"') + '"'
      ], {
        cwd: self.siteBasePath,
        stdio: [
            'ignore',
            'pipe',
            'pipe'
        ]
        // TODO: Set 'env.DEBUG' based on 'self.opts.debug'
      });
      self.proc.on("error", function (err) {
        throw err;
      });
      self.proc.on("close", function (code) {
        if (self.opts.debug) {
          console.log("[docker][run] Process ended with code '" + code + "' for:", self.path);
        }
        Object.keys(self.proc.docker).forEach(function (name) {
          self.proc.docker[name] = undefined;
        });
        self.proc.emit("docker", null);
        self.proc = null;
      });

      self.proc.docker = {};
      var m;
      self.proc.stdout.on("data", function (chunk) {
        m = chunk.toString().match(/\[docker\]\[set\] (.+)\n/);
        if (m) {
          try {
            m = JSON.parse(m[1]);
          } catch (err) {
            console.error("Error parsing JSON:", m[1]);
          }
          Object.keys(m).forEach(function (name) {
            self.proc.docker[name] = m[name];
            self.proc.emit("docker." + name, self.proc.docker[name]);
          });
        }
      });

      // TODO: How can I access 'process.env.NODE_ENV' when 'process' is not available in this context?
      if (self.opts.debug) {
        self.proc.stdout.on("data", function (chunk) {
          console.log("[docker][run][stdout]", chunk.toString());
        });
        self.proc.stderr.on("data", function (chunk) {
          console.error("[docker][run][stderr]", chunk.toString());
        });
      }

      return self.proc;
    } catch (e) {
      throwWithFixedStack(e, errStack)
    }
  }

  stop () {
    var errStack = (new Error()).stack
    var self = this;
    try {
      if (!self.proc) {
        throw new Error("Process is not running.");
      }

      var proc = SPAWN(self.dockerControlPath, [
          "stop"
      ], {
        cwd: self.siteBasePath,
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
      if (self.opts.debug) {
        proc.stdout.on("data", function (chunk) {
          console.log("[docker][stop][stdout]", chunk.toString());
        });
        proc.stderr.on("data", function (chunk) {
          console.error("[docker][stop][stderr]", chunk.toString());
        });
      }

    } catch (e) {
      throwWithFixedStack(e, errStack)
    }
  }
}

export default Docker


// internal methods
// =

function throwWithFixedStack (e, errStack) {
  e = e || new Error()
  e.stack = e.stack.split('\n')[0] + '\n' + errStack.split('\n').slice(2).join('\n')
  throw e
}
