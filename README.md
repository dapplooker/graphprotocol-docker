# graphprotocol-docker
### Run graph indexer and query node docker containers
- To run the setup update `src/.env` file with required parameters
- Navigate to folder `src` by doing `cd src`.
- Run command `bash start_setup.sh .env all`


A simple way to check that `graphman` is set up correctly is to run
`graphman --config <config.toml> info <some/subgraph>`. If that subgraph exists, the command will
print basic information about it, like the namespace in Postgres that
contains the data for the underlying deployment.

## Removing unused deployments

Before starting we need to fill the details in `src/config.toml` file and `docker cp` to `graph-node-indexer`.
These unused deployments can be removed by running below, which compiles a list of unused deployments:
`graphman --config <config.toml>  unused record`

That list can then be inspected with:
`graphman --config <config.toml> unused list -e`

The data for these unused deployments can then be removed with: 
`graphman --config <config.toml> unused remove`

## Removing a subgraph

The command `graphman --config <config.toml> remove some/subgraph` will remove the mapping from
the given name to the underlying deployment. If no other subgraph name uses
that deployment, it becomes eligible for removal, and the steps for
removing unused deployments will delete its data.

For more details: https://github.com/graphprotocol/graph-node/blob/master/docs/maintenance.md
