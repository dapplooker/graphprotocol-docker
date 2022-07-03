# graphprotocol-docker
### Run graph indexer and query node docker containers
- To run the setup update `src/.env` file with required parameters
- Navigate to folder `src` by doing `cd src`.
- Run command `bash start_setup.sh .env all`

# Common maintenance tasks

This document explains how to perform common maintenance tasks using
`graphman`. The `graphman` command is included in the official containers,
and you can `docker exec` into your `graph-node-indexer` container to run it.

Before starting we need to fill the details in `src/config.toml` file and `docker cp` to `graph-node-indexer`.
The command pays attention to the `GRAPH_LOG` environment variable, and
will print normal `graph-node-indexer` logs on stdout. You can turn them off by
doing `unset GRAPH_LOG` before running `graphman`.

A simple way to check that `graphman` is set up correctly is to run
`graphman --config <config.toml> info <some/subgraph>`. If that subgraph exists, the command will
print basic information about it, like the namespace in Postgres that
contains the data for the underlying deployment.

## Removing unused deployments

When a new version of a subgraph is deployed, the new deployment displaces
the old one when it finishes syncing. At that point, the system will not
use the old deployment anymore, but its data is still in the database.

These unused deployments can be removed by running `graphman --config <config.toml>  unused record`
which compiles a list of unused deployments. That list can then be
inspected with `graphman --config <config.toml> unused list -e`. The data for these unused
deployments can then be removed with `graphman --config <config.toml>  unused remove` which will
only remove the deployments that have previously marked for removal with
`record`.

## Removing a subgraph

The command `graphman --config <config.toml> remove some/subgraph` will remove the mapping from
the given name to the underlying deployment. If no other subgraph name uses
that deployment, it becomes eligible for removal, and the steps for
removing unused deployments will delete its data.
