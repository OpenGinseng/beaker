#!/usr/bin/env bash

parsedArgs=$(node --eval '
    const argv = require("/dl/spaces/o/io.ginseng/beaker/app/node_modules/yargs").argv
    process.stdout.write("action=\"" + argv.$0 + "\"\n");
' "$@")
eval "$parsedArgs"

if [ "${action}" == "run" ]; then

    parsedArgs=$(node --eval '
        const argv = require("/dl/spaces/o/io.ginseng/beaker/app/node_modules/yargs").argv
        process.stdout.write("containerPath=\"" + argv.path + "\"\n");
        process.stdout.write("runCommand=" + argv.command + "\n");
        process.stdout.write("sitePath=\"" + process.cwd() + "\"\n");

        var tag = "beaker/" + require("path").basename(process.cwd()) + "/" + argv.instance;
        process.stdout.write("tag=\"" + tag + "\"\n");
        process.stdout.write("containerName=\"docker_" + tag.replace(/\//g, "_") + "\"\n");

        require("/dl/spaces/o/io.ginseng/beaker/node_modules/get-port")().then(function (port) {
            process.stdout.write("port=\"" + port + "\"\n");
        });
    ' "$@")
    eval "$parsedArgs"

    docker build \
        -t "${tag}" \
        "${containerPath}"

    echo "[docker][set] {\"HTTP_PORT\":${port}}"

    echo "[docker] Running container '${containerName}' with tag '${tag}''"

    docker run \
        --mount type=bind,source=${sitePath},destination=/site,consistency=cached \
        --name "${containerName}" \
        -p "${port}:80" \
        "${tag}" \
        ${runCommand}

elif [ "${action}" == "stop" ]; then

    parsedArgs=$(node --eval '
        const argv = require("/dl/spaces/o/io.ginseng/beaker/app/node_modules/yargs").argv

        var tag = "beaker/" + require("path").basename(process.cwd()) + "/" + argv.instance;
        process.stdout.write("tag=\"" + tag + "\"\n");
        process.stdout.write("containerName=\"docker_" + tag.replace(/\//g, "_") + "\"\n");
    ' "$@")
    eval "$parsedArgs"

    containerId=$(docker ps -aqf "name=${containerName}")

    echo "[docker] Stopping container '${containerName}' with tag '${tag}'"

    docker stop "${containerId}"
    docker rm "${containerId}"

    echo "[docker] Stopped container '${containerName}' with tag '${tag}'"

fi
