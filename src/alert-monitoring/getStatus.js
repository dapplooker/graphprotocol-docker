import fetch from "node-fetch"
import { createRequire } from "module"; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url);
globalThis.fetch = fetch


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

export class getDataToMonitorStatus {

    static async getSubgraphData(indexerGraphQLURL) {
        const data = JSON.stringify({query: indexerQuery});
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

    static getSubgraphError(allIndexedSubgraphs, archiveNodeLatestBlock, currentNetwork) {
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

    asyncCallWithTimeout = async (asyncPromise, timeLimit) => {
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

    static getLatestBlockNumber = async (rpcNodeLink, network) => {
        try {
            const {createAlchemyWeb3} = require("@alch/alchemy-web3");
            const web3 = createAlchemyWeb3(rpcNodeLink);
            const blockNumber = await getDataToMonitorStatus().asyncCallWithTimeout(web3.eth.getBlockNumber(), 2000);
            console.log(`The latest block number is ${blockNumber} for network ${network}`);
            return blockNumber;
        } catch (err) {
            console.error(err);
        }
        return 0;
    }
}