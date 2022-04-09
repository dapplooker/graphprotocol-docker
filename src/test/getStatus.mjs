import fetch from "node-fetch"
globalThis.fetch = fetch

const BATCH_SIZE=999
const MAX_QUERY_AT_TIME=1000


function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

const GRAPH_NODE="";

async function getData() {
    const data = JSON.stringify(
        {
            query: `{ 
                indexingStatuses  { 
                    subgraph synced health entityCount 
                    chains { 
                        chainHeadBlock { number } 
                        earliestBlock { number } 
                        latestBlock { number }
                    } 
                    fatalError {
                        message
                        block { hash number }
                        handler deterministic
                    }
                } 
            }`,
        });

    console.log(`Query: `+ data);
    const response = await fetch(
        `http://${GRAPH_NODE}/graphql`,
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
        let indexingStatus = queryResult["data"]["indexingStatuses"]

        for (let idx = 0; idx < indexingStatus.length; idx++) {
            console.log("============================");
            let subgraphId = indexingStatus[idx]["subgraph"]
            let subgraphEntityCount = indexingStatus[idx]["entityCount"]
            console.log(`Subgraph ID: ${subgraphId}`);
            console.log(`Subgraph entity count: ${subgraphEntityCount}`);
            console.log(`Subgraph error: ${indexingStatus[idx]["fatalError"]}`);

            let chains = indexingStatus[idx]["chains"]
            for (let chain_idx = 0; chain_idx < chains.length; chain_idx++) {
                let chainHeadBlock = chains[chain_idx]["chainHeadBlock"]["number"]
                let latestBlock = chains[chain_idx]["latestBlock"]["number"]
                let progressPercentage = (latestBlock/chainHeadBlock) * 100
                console.log(`Progress percentage : ${progressPercentage.toFixed(2)}%`);
            }
        }
    }

    return status
}

getData()
