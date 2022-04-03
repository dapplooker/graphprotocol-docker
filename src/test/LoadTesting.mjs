import fetch from "node-fetch"
globalThis.fetch = fetch

function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}

const BATCH_SIZE=10;
const GRAPH_NODE="celo-graph-api.dapplooker.com";

async function getData(call_number) {
    console.log("Calling for " + call_number);
    const data = JSON.stringify(
        {
            query: `{
                {
                    tokenDayDatas(first: ${call_number%BATCH_SIZE}) {
                        id
                        timestamp
                        dailyVolumeToken
                        dailyTxns
                        lastUpdatedTimestamp
                      }
                }
            }`,
        });
    console.log(`Query:`+ data);
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

    const status = await response.status;
    const queryResult = await response.json();
    console.log("Calling done for " + call_number + ":" + status + ",queryResponse:" + queryResult.data);
    // console.log(json.data);
    return status
}


// for (let call_number = 0; call_number < 1000; call_number++) {
//     try {
//         getData(call_number);
//     }
//     catch (e){
//         console.log("Failed with error: " + e.text)
//     }
//     delay(2)
// }

const ONE_SECOND = 1000;

async function rateLimitedRequests (maxCall) {
    let results = [];

    while (maxCall > 0) {
        let batch = [];
        let startTime = Date.now();

        for (let call_number = 0; call_number < BATCH_SIZE; call_number++) {
            batch.push(getData(call_number));
        }

        results = results.concat(await Promise.all(batch));
        for (let i = 0; i < BATCH_SIZE; i++){
            if (results[i] !== 200) {
                console.log("Failed to query " + i)
            }
        }

        let endTime = Date.now();
        let requestTime = endTime - startTime;
        console.log("Finished in seconds: " + (requestTime/1000))

        await delay(1000);
        maxCall --;
    }

    return results;
}


try {
    rateLimitedRequests(1);
}
catch (e){
    console.log("Failed with error: " + e.text)
}
