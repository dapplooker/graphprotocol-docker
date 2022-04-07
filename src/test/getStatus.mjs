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
                indexingStatuses { subgraph synced health entityCount chains { chainHeadBlock { number }
                earliestBlock { number } latestBlock { number }
                } } }`,
        });

    console.log(`Query: `+ data);
    const response = await fetch(
        `https://${GRAPH_NODE}/subgraphs/name/dapplooker/celo-tokens-analytics-subgraph`,
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
    const queryResult = await response.json();
    console.log("queryResponse:" + JSON.stringify(queryResult));
    return status
}

getData()
