
const PATH = require("path");

//import { ipcRenderer, remote } from 'electron'
const EventEmitter = require("events").EventEmitter


import rpc from 'pauls-electron-rpc'
import errors from 'beaker-error-constants'
import dockerManifest from '../lib/api-manifests/external/docker'

// create the rpc api
const dockerRPC = rpc.importAPI('docker', dockerManifest, { timeout: false, errors })



const Plugins = function () {
    const self = this;


    var currentWindow = null;

    self.init = function (window) {

        currentWindow = window;

        console.log("[beaker][shell-window] init", window);

        function injectCSS (css) {
            var style = window.document.createElement("style");
            style.setAttribute('type', 'text/css');
            style.appendChild(document.createTextNode(css));
            window.document.getElementsByTagName("head")[0].appendChild(style);
        }

        function injectPanel (id, url) {
            var container = window.document.createElement("webview");
            container.setAttribute("id", id);
            container.setAttribute("src", url);
            window.document.querySelector("#statusbar").insertAdjacentElement('afterend', container);
        }

        injectCSS(`
            BODY.ginseng-panels-showing #webviews {
                margin-left: 200px;
                margin-right: 100px;
                margin-bottom: 200px;
            }
            BODY.ginseng-panels-showing #webviews > webview {
                padding-bottom: 200px;
            }
            #panel-left {
                display: none;
            }
            BODY.ginseng-panels-showing #panel-left {
                display: block;
                position: absolute;
                top: 74px;
                width: 200px;
                height: calc(100vh - 74px);
                background-color: #ffffff;
                border-right: 1px solid #ececec;
            }
            #panel-right {
                display: none;
            }
            BODY.ginseng-panels-showing #panel-right {
                display: block;
                position: absolute;
                top: 74px;
                left: calc(100vw - 100px);
                width: 100px;
                height: calc(100vh - 74px);
                background-color: #ffffff;
                border-left: 1px solid #ececec;
            }
            #panel-bottom {
                display: none;
            }
            BODY.ginseng-panels-showing #panel-bottom {
                display: block;
                position: absolute;
                left: 200px;                
                top: calc(100vh - 200px);
                width: 100%;
                height: 200px;
                z-index: 100;
                background-color: #ffffff;
                border-top: 1px solid #ececec;
            }

            .plugin-buttons {
                height: 17px;
                display: inline-flex;
            }
            .ginseng-toggle-button > IMG {
                height: 19px;
            }
            .docker-status-button > DIV {
                margin-top: 1px;
                margin-right: 5px;
                width: 22px;
                height: 17px;
                background-image: url("beaker://plugins/docker/docker-toolbar-icon-blue.png");
                background-size: 22px 17px;
            }
            .docker-status-button > DIV.ok {
                background-image: url("beaker://plugins/docker/docker-toolbar-icon-green.png");
            }
            .docker-status-button > DIV.fail {
                background-image: url("beaker://plugins/docker/docker-toolbar-icon-red.png");
            }
        `);

        injectPanel("panel-left", "about:blank");
        injectPanel("panel-right", "about:blank");
        injectPanel("panel-bottom", "about:blank");
    }

    self.on("workspace-url-loaded", function (page) {

        console.log("[beaker][shell-window] workspace url loaded", page);

        selectPage(page);
    });

    function setUrlFor (id, url) {
        if (!currentWindow) return;
        var panelEl = currentWindow.document.getElementById(id);
        if (!panelEl) return;
        panelEl.setAttribute("src", "http://localhost:" + window.process.env.GINSENG_UI_PORT + "/ui.api/shell-window-" + id + ".html?workspace=" + encodeURIComponent(url));
    }

    var enabledById = {};

    function showPanels (page) {

console.log("showPanels()");        
        
        setUrlFor("panel-left", page._url);
        setUrlFor("panel-right", page._url);
        setUrlFor("panel-bottom", page._url);

        var className = currentWindow.document.querySelector('BODY').className;
        if (!/ ginseng-panels-showing/.test(className)) {
            currentWindow.document.querySelector('BODY').className += " ginseng-panels-showing";
        }
console.log("showPanels()", currentWindow.document.querySelector('BODY').className);        


        var view = currentWindow.document.querySelector('WEBVIEW[data-id="' + page.id + '"]');

        view.addEventListener("did-get-response-details", function (event) {

console.log("RESPONSE DETAILS:", event);

        });

//        currentWindow.document.querySelector('BODY').className += " ginseng-panels-showing";
        
    }

    function hidePanels (page) {
        if (!currentWindow) return;
        var className = currentWindow.document.querySelector('BODY').className;
console.log("hidePanels()", className);        
        currentWindow.document.querySelector('BODY').className = className.replace(" ginseng-panels-showing", "");
console.log("hidePanels()", currentWindow.document.querySelector('BODY').className);        
    }

    function togglePanels (page) {

console.log("togglePanels()");        

        if (enabledById[page.id]) {
            enabledById[page.id] = null;
            delete enabledById[page.id];
            hidePanels(page);
        } else {
            enabledById[page.id] = true;
            showPanels(page);
        }
    }

    function ensureToggleButton (page) {
        if (!currentWindow) return;

        var view = currentWindow.document.querySelector('.toolbar-actions[data-id="' + page.id + '"]');
        if (!view) return;

        var buttonEl = view.querySelector('.ginseng-toggle-button');
        if (/^workspace:\/\//.test(page._url)) {
            buttonEl.style.opacity = "1";
            if (!buttonEl._ginsengToggleButtonAdded) {
                buttonEl._ginsengToggleButtonAdded = function (event) {
                    togglePanels(page);
                };
                buttonEl.addEventListener("click", buttonEl._ginsengToggleButtonAdded);
            }
            buttonEl.querySelector('IMG').style.cursor = "pointer";
        } else {
            buttonEl.style.opacity = "0.3";
            if (buttonEl._ginsengToggleButtonAdded) {
                buttonEl.removeEventListener("click", buttonEl._ginsengToggleButtonAdded);
            }
            delete buttonEl.querySelector('IMG').style.cursor;
        }
    }

    var activePage = null;

    var dockerClassForPage = {};


    function selectPage (page) {
        
        if (
            /^workspace:\/\//.test(page._url) &&
            enabledById[page.id]
        ) {
            showPanels(page);
        } else {
            hidePanels();
        }

        ensureToggleButton(page);
        setDockerStatusForPage(page, dockerClassForPage[page.id]);

        // Wait for toolbar actions to appear
        setTimeout(function () {
            ensureToggleButton(page);
            setDockerStatusForPage(page, dockerClassForPage[page.id]);
        }, 250);


        if (!page.siteInfo) {
//console.log("no page info");            
            activePage = null;
            return;
        }
        
        activePage = page;


        /*
        dockerRPC.setActiveWorkspace({
            id: page.id,
            url: page._url,
            localFilesPath: page.siteInfo.localFilesPath
        });
        */

        var view = currentWindow.document.querySelector('WEBVIEW[data-id="' + page.id + '"]');
        view.send("plugins:workspace-context", {
            id: page.id,
            url: page._url,
            localFilesPath: page.siteInfo.localFilesPath
        });

        if (!view._dockerEventStream) {
            view._dockerEventStream = dockerRPC.getEventStream();
            view._dockerEventStream.on("data", function (message) {

                console.log("docker event", message[0], message[1]);

                if (message[0] === "present") {
                    setDockerStatusForPage(page, "");
                } else
                if (message[0] === "started") {
                    setDockerStatusForPage(message[1].workspaceContext, "ok");
                } else
                if (message[0] === "stopped") {
                } else
                if (message[0] === "destroyed") {
                    setDockerStatusForPage(message[1].workspaceContext, "");
                } else
                if (message[0] === "fail") {
                    console.error("Docker fail:", message[1]);
                    setDockerStatusForPage(message[1].workspaceContext, "fail");
                }        
            });
        }
    }

    function setDockerStatusForPage (page, className) {
        if (!currentWindow) return;
        var view = currentWindow.document.querySelector('.toolbar-actions[data-id="' + page.id + '"]');
        if (!view) return;
        dockerClassForPage[page.id] = className;
        var buttonEl = view.querySelector('.docker-status-button');
        var buttonIconEl = buttonEl.querySelector('DIV');

        if (typeof className !== "undefined") {
            buttonIconEl.className = className;
            buttonEl.style.opacity = "1";
            if (!buttonEl._dockerClickButtonAdded) {
                buttonEl._dockerClickButtonAdded = function (event) {

                    console.log("clicked docker button: TODO: show console panel with shell output");

                };
                buttonEl.addEventListener("click", buttonEl._dockerClickButtonAdded);
            }
            buttonEl.style.cursor = "pointer";

        } else {
            buttonIconEl.className = "";
            buttonEl.style.opacity = "0.3";
            if (buttonEl._dockerToggleButtonAdded) {
                buttonEl.removeEventListener("click", buttonEl._dockerToggleButtonAdded);
            }
            delete buttonEl.style.cursor;
        }
    }

    self.getActivePage = function () {
        return activePage;
    }


    self.on("focused-workspace", function (page) {
        console.log("[beaker][shell-window] focused workspace", page.id, page);

        selectPage(page);
    });
    
    self.on("removed-workspace", function (page) {
        console.log("[beaker][shell-window] removed workspace", page.id, page);

        dockerRPC.removeWorkspace({
            id: page.id,
            url: page._url,
            localFilesPath: (page.siteInfo && page.siteInfo.localFilesPath) || null
        });
    });

    /*
    self.on("workspace-url-selected", function (page) {
        console.log("[beaker][shell-window] workspace url selected", page);
        selectPage(page);
    });
    */

    self.getCode = function (id, yo) {
        if (id === 'navbar-toolbar-input-group') {
            return yo`
                <div class="plugin-buttons">
                    ${yo`<div class="docker-status-button">
                        <DIV></DIV>
                    </div>`}            
                    ${yo`<div class="ginseng-toggle-button">
                        <img src="http://localhost:${window.process.env.DEVCOMP_UI_PORT}/ui.api/icon.png"></img>
                    </div>`}
                </div>`
        }
        throw new Error("No code for id '" + id + "'!");
    }
}
Plugins.prototype = Object.create(EventEmitter.prototype);


const plugins = new Plugins();

export default plugins
