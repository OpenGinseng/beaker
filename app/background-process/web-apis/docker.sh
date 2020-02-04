#!/usr/bin/env bash

echo "PATH: ${PATH}"
echo "ELECTON_BIN: ${ELECTON_BIN}"
echo "DOCKER_CLI_APP: ${DOCKER_CLI_APP}"

parsedArgs=$("${ELECTON_BIN}" "${DOCKER_CLI_APP}" --script "docker.sh[1]" "$@")
echo "parsedArgs: ${parsedArgs}"
eval "$parsedArgs"

if [ "${action}" == "run" ]; then

    parsedArgs=$("${ELECTON_BIN}" "${DOCKER_CLI_APP}" --script "docker.sh[2]" "$@")
    echo "parsedArgs: ${parsedArgs}"
    eval "$parsedArgs"

    echo "[docker] which docker"
    if ! which docker; then
        >&2 echo "ERROR: 'docker' command not found!"
        exit 1
    fi

    echo "[docker] run --version"
    docker --version

    echo "[docker] run build"
    docker build \
        -t "${tag}" \
        "${containerPath}"

    echo "[docker][set] {\"HTTP_PORT\":${port}}"

    echo "[docker] run ps"
    existingContainerId=$(docker ps -aqf "name=${containerName}")
    if [ "$existingContainerId" != "" ]; then
        echo "[docker] Removing existing container '${containerName}' with id '${existingContainerId}' and tag '${tag}'"
        echo "[docker] run stop"
        docker stop "${existingContainerId}" || true
        echo "[docker] run rm"
        docker rm "${existingContainerId}"
    fi

    echo "[docker] Running container '${containerName}' with tag '${tag}''"

    echo "[docker] run run"
    docker run \
        --mount type=bind,source=${sitePath},destination=/site,consistency=cached \
        --name "${containerName}" \
        -p "${port}:80" \
        "${tag}" \
        ${runCommand}

elif [ "${action}" == "stop" ]; then

    parsedArgs=$("${ELECTON_BIN}" "${DOCKER_CLI_APP}" --script "docker.sh[3]" "$@")
    echo "parsedArgs: ${parsedArgs}"
    eval "$parsedArgs"

    echo "[docker] run ps"
    containerId=$(docker ps -aqf "name=${containerName}")

    echo "[docker] Stopping container '${containerName}' with tag '${tag}'"

    echo "[docker] run stop"
    docker stop "${containerId}"
    echo "[docker] run rm"
    docker rm "${containerId}"

    echo "[docker] Stopped container '${containerName}' with tag '${tag}'"

fi
