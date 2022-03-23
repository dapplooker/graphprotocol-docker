import fetch from "node-fetch"
globalThis.fetch = fetch

const BATCH_SIZE=999
const MAX_QUERY_AT_TIME=1000


function delay(t) {
    return new Promise(resolve => setTimeout(resolve, t));
}


async function getData(call_number) {
    console.log("Calling for " + call_number);
    const data = JSON.stringify(
        {
            query: `{ tokenDayDatas(first: ${call_number % MAX_QUERY_AT_TIME}) { id timestamp dailyVolumeToken dailyTxns lastUpdatedTimestamp } }`,
        });

    console.log(`Query: `+ data);
    const response = await fetch(
        "http://194.163.171.50:8000/subgraphs/name/dapplooker/celo-tokens-analytics-subgraph",
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
    // console.log("Calling done for " + call_number + ":" + status + ", queryResponse:" + JSON.stringify(queryResult));
    return status
}

async function rateLimitedRequests (maxCall) {
    let results = [];

    while (maxCall > 0) {
        let batch = [];
        let startTime = Date.now();

        for (let call_number = 1; call_number <= BATCH_SIZE; call_number++) {
            batch.push(getData(call_number));
        }

        results = results.concat(await Promise.all(batch));
        let endTime = Date.now();
        let requestTime = endTime - startTime;
        console.log("Waiting on result: " + (requestTime/1000))

        for (let i = 1; i <= BATCH_SIZE; i++){
            if (results[i] !== 200) {
                console.log("Failed to query " + i)
            }
        }

        endTime = Date.now();
        requestTime = endTime - startTime;
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
