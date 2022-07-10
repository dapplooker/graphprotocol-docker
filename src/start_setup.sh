#!/bin/bash

if [[ "$1" == "-h" ]]; then
    echo "Usage: sh start_setup.sh <docker-compose-file> <environment_file_path> <service_name>"
    echo "service names [all, graph-node-indexer, graph-node-query-0, graph-node-query-1, ipfs, database]] for celo"
    echo "service names [all, eth-graph-node-indexer, eth-graph-node-query-0,
            eth-graph-node-query-1, eth-ipfs, eth-database]] for etherum"
    exit 0
fi

if [[ "$#" -lt 2 ]]
then
    echo "Please provide docker file and environment file path"
    exit 0
fi

echo "Environment file $2"
. ./"$2"

if [[ "$3" == "all" ]] || [[ "$#" -eq 1 ]];
then
    echo "Starting all services from docker file $1"
    docker compose -f "$1" up -d --build
    exit 0
fi

echo "Starting all services from docker file $1, service: $3"
docker compose -f "$1" up -d --build "$3"
