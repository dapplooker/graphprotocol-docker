import fetch from "node-fetch"
import { createRequire } from "module"; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url);
globalThis.fetch = fetch

function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

const GRAPH_NODE="";
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

export async function getSubgraphData(indexerGraphQLURL) {
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
        console.log(`${JSON.stringify(queryResult["data"]["indexingStatuses"])}`)
        return queryResult["data"]["indexingStatuses"]
    } else {
        return null
    }
}

export function getSubgraphError(allIndexedSubgraphs, archiveNodeLatestBlock, currentNetwork){
    let errorMessageList = []
    for (let idx = 0; idx < allIndexedSubgraphs.length; idx++) {
        let subgraphId = allIndexedSubgraphs[idx]["subgraph"]
        console.log(`Processing subgraph ${subgraphId} on network ${currentNetwork}`);
        if (allIndexedSubgraphs[idx]["fatalError"] !== null){
            return allIndexedSubgraphs[idx]["fatalError"]
        }
        let chains = allIndexedSubgraphs[idx]["chains"]
        console.log(`Starting chains for subgraph ${subgraphId}`)
        for (let chain_idx = 0; chain_idx < chains.length; chain_idx++) {
            let network = chains[chain_idx]["network"]
            if (chains[chain_idx]["latestBlock"] === null){
                continue
            }
            let latestBlock = chains[chain_idx]["latestBlock"]["number"]
            let blockDifference = archiveNodeLatestBlock - latestBlock
            if (blockDifference > process.env.BLOCK_DIFFERENCE_ALERT){
                let errorMsg = `Subgraph ${subgraphId} is running behind by ${blockDifference} for network ${network}`
                console.log(errorMsg)
                errorMessageList.push()
            }
        }
    }
    return errorMessageList
}


export async function getLatestBlockNumber(rpcNodeLink, network) {
    const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
    const web3 = createAlchemyWeb3(rpcNodeLink);
    const blockNumber = await web3.eth.getBlockNumber();
    console.log(`The latest block number is ${blockNumber} for network ${network}`);
    return blockNumber
}
