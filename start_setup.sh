#!/bin/bash

if [ "$1" == "-h" ]; then
  echo "Usage: sh start_setup.sh <environment_file_path> <service_name>"
  echo "service_name can be [all, graph-node-indexer, graph-node-query-0, graph-node-query-1, ipfs, database]"
  exit 0
fi

if [ "$#" -eq 0 ]
then
  echo "Please provide environment file path"
  exit 0
fi

echo "Environment file $1"
. ./$1

if [ "$2" == "all" ] ||  [ "$#" -eq 1 ]; then
  docker-compose up -d --remove-orphans --build
  exit 0
fi

docker-compose up -d --remove-orphans --build $2
