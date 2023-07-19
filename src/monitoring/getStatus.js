import fetch from "node-fetch"
import { createRequire } from "module"; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url);
globalThis.fetch = fetch

const { exec } = require('child_process');

let indexerQuery = `{ 
        indexingStatuses  { 
            subgraph synced health entityCount 
            chains { 
                latestBlock { number }
                network
            } 
            fatalError {
                message
                block { hash number }
                handler deterministic
            }
        } 
    }`

export class DataToMonitorStatus {

    async getSubgraphData(indexerGraphQLURL) {
        const data = JSON.stringify({ query: indexerQuery });
        const response = await fetch(
            indexerGraphQLURL,
            {
                method: 'post',
                body: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'User-Agent': 'Node',
                },
            }
        );

        const status = response.status;
        console.log("Status: " + status);

        if (status === 200) {
            const queryResult = await response.json();
            console.log(`${JSON.stringify(queryResult["data"]["indexingStatuses"])}`);
            return queryResult["data"]["indexingStatuses"];
        } else {
            return null;
        }
    }

    getSubgraphError(allIndexedSubgraphs, archiveNodeLatestBlock, currentNetwork) {
        let errorMessageList = [];
        for (let idx = 0; idx < allIndexedSubgraphs.length; idx++) {
            let subgraphId = allIndexedSubgraphs[idx]["subgraph"];
            console.log(`Processing subgraph ${subgraphId} on network ${currentNetwork}`);
            if (allIndexedSubgraphs[idx]["fatalError"] !== null) {
                return allIndexedSubgraphs[idx]["fatalError"];
            }
            let chains = allIndexedSubgraphs[idx]["chains"];
            console.log(`Starting chains for subgraph ${subgraphId}`);
            for (let chain_idx = 0; chain_idx < chains.length; chain_idx++) {
                let network = chains[chain_idx]["network"];
                if (chains[chain_idx]["latestBlock"] === null) {
                    continue;
                }
                let latestBlock = chains[chain_idx]["latestBlock"]["number"];
                let blockDifference = Math.abs(archiveNodeLatestBlock - latestBlock);
                if (blockDifference > process.env.BLOCK_DIFFERENCE_ALERT) {
                    let errorMsg = `Subgraph ${subgraphId} is running behind by ${blockDifference} \
                        for network ${network}`;
                    console.log(errorMsg);
                    errorMessageList.push(errorMsg);
                }
            }
        }
        return errorMessageList;
    }

    async asyncCallWithTimeout(asyncPromise, timeLimit) {
        let timeoutHandle;

        const timeoutPromise = new Promise((_resolve, reject) => {
            timeoutHandle = setTimeout(
                () => reject(new Error('Async call timeout limit reached')),
                timeLimit
            );
        });

        return Promise.race([asyncPromise, timeoutPromise]).then(result => {
            clearTimeout(timeoutHandle);
            return result;
        })
    }

    getLatestBlockNumber = async (rpcNodeLink, network) => {
        try {
            const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
            const web3 = createAlchemyWeb3(rpcNodeLink);
            const blockNumber = await this.asyncCallWithTimeout(web3.eth.getBlockNumber(), 4000);
            console.log(`The latest block number is ${blockNumber} for network ${network}`);
            return blockNumber;
        } catch (err) {
            console.error(err);
        }
        return 0;
    }

    /**
 * Asynchronously checks if the GraphQL node for the given indexer URL is up.
 *
 * @param {string} indexerGraphQLURL - The URL of the indexer's GraphQL endpoint.
 * @returns {Promise<boolean>} A promise that resolves with a boolean value indicating
 *          whether the GraphQL node is up (true) or not (false).
 */
    async checkGraphNodeStatus(indexerGraphQLURL) {
        let checkQuery = `{ 
            indexingStatuses  { 
                subgraph
            } 
        }`
        const data = JSON.stringify({ query: checkQuery });
        const response = await fetch(
            indexerGraphQLURL,
            {
                method: 'post',
                body: data,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'User-Agent': 'Node',
                },
            }
        );

        const status = response.status;

        if (status === 200) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Asynchronously checks the disk space for the specified network machine.
     *
     * @param {string} network - The name of the network machine.
     * @returns {Promise<number|null>} A promise that resolves with the disk capacity in megabytes (MB),
     *          or null if the information is not found.
     */
    async getDiscCapacity(network) {
        console.log(`========= Checking disk space for ${network} machine =========`);
        return new Promise((resolve, reject) => {
            // Execute the 'df -h --block-size=M' command to get disk capacity information in human-readable format
            exec('df -h --block-size=G', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing command: ${error.message}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.error(`Command stderr: ${stderr}`);
                    reject(stderr);
                    return;
                }

                // Split the command output into an array of lines
                const diskCapacityLines = stdout.trim().split('\n');

                // Find the line that contains '/dev/nvme0n1p5'
                const diskCapacityLine = diskCapacityLines.find(line => line.includes('/dev/nvme0n1p5'));

                if (diskCapacityLine) {
                    // Extract the disk size from the line
                    const diskCapacityColumns = diskCapacityLine.split(/\s+/);
                    const diskSize = diskCapacityColumns[1];
                    console.log(`Host Disk Capacity: ${diskSize}`);
                    // Remove the 'G' suffix from the disk size and convert it to an integer
                    let diskSizeInt = diskSize.substring(0, diskSize.length - 1);
                    resolve(diskSizeInt);
                } else {
                    console.log(`No information found for /dev/nvme0n1p5.`);
                    resolve(null);
                }
            });
        });
    }


}
