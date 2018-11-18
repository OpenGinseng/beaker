
const { app } = require('electron');
const argv = require("yargs").argv;


function main () {

    process.stdout.write("#argv: " + JSON.stringify(argv) + "\n");


    if (argv.script === "docker.sh[1]") {

        process.stdout.write("action=\"" + argv._[0] + "\"\n");

    } else
    if (argv.script === "docker.sh[2]") {

        process.stdout.write("containerPath=\"" + argv.path + "\"\n");
        process.stdout.write("runCommand=" + argv.command + "\n");
        process.stdout.write("sitePath=\"" + process.cwd() + "\"\n");

        var tag = "beaker/" + require("path").basename(process.cwd()) + "/" + argv.instance;
        process.stdout.write("tag=\"" + tag + "\"\n");
        process.stdout.write("containerName=\"ginseng_" + tag.replace(/\//g, "_") + "\"\n");

        require("get-port")().then(function (port) {
            process.stdout.write("port=\"" + port + "\"\n");
        });
    } else
    if (argv.script === "docker.sh[3]") {

        var tag = "beaker/" + require("path").basename(process.cwd()) + "/" + argv.instance;
        process.stdout.write("tag=\"" + tag + "\"\n");
        process.stdout.write("containerName=\"ginseng_" + tag.replace(/\//g, "_") + "\"\n");

    } else
    if (argv.script === "process-monitor") {

        console.log("[docker][process-monitor] starting");

        const EXEC = require("child_process").execSync;
        const PS_TREE = require('ps-tree');

        // TODO: Instead of getting 'electronPid' from argument, run 'docker ps' to get list of process IDs
        //       based on docker instance name.
        const electronPid = parseInt(argv.pid);

        console.log("[docker][process-monitor] electronPid: " + electronPid);

        function getInstanceIds () {
            try {
                var dockerInstances = EXEC('docker ps -a | grep ' + electronPid + ' || true').toString();
                dockerInstances = dockerInstances.split("\n").map(function (line) {
                    return line.split(" ")[0];
                }).filter(function (id) {
                    return !!id;
                });
                return dockerInstances;
            } catch (err) {
                console.error("WARNING:", err);
                return [];
            }
        }


        var interval = setInterval(function () {
        
            PS_TREE(electronPid, function (err, children) {

                if (
                    !children ||
                    children.length === 0
                ) {
                    console.log("[docker][process-monitor] Electron process '" + electronPid + "' has exited!");
        
                    var instanceIds = getInstanceIds();
                    if (instanceIds.length) {
                        clearInterval(interval);

                        console.log("[docker][process-monitor] Stopping and removing docker instances:", instanceIds);
        
                        EXEC('docker stop ' + instanceIds.join(" "));
                        EXEC('docker rm ' + instanceIds.join(" "));
                    }
                    app.quit();
                } else {

                    console.log("[docker][process-monitor] children.length: " + children.length);

                }
            });
        
        }, 5000);

        return;
    }

    app.quit();

}

main();
