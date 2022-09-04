import {
    getLatestBlockNumber,
    getSubgraphData, getSubgraphError
} from './getStatus.js';
import { createRequire } from "module";
import {SesClient} from "./emailClient.js"
import Constant from './config/constants.js';


const require = createRequire(import.meta.url);
const fullConfig = require('./config/config.json');
let allNetworkIndexer = fullConfig['network_index']


export async function monitoringIndexer() {
    for (const [network, config] of Object.entries(allNetworkIndexer)) {
        console.log(`Starting monitoring ${network}, config provided ${JSON.stringify(config)}`);
        let graphIndexerNode = config['graph_indexer_node']
        let archiveNode = config['archive_node']
        let externalRpcNode = config['external_rpc_node']
        if (!(archiveNode || externalRpcNode || graphIndexerNode)) {
            console.log(`Detail missing for ${network} in config, please check and update`)
            continue
        }

        // Get all data required from archive/external RPC node and subgraph data
        let archiveNodeLatestBlock = await getLatestBlockNumber(archiveNode, network)
        let externalRpcNodeLatestBlock = await getLatestBlockNumber(externalRpcNode, network)
        let subgraphData = await getSubgraphData(graphIndexerNode)

        let errorMessages = getErrorMessage(archiveNodeLatestBlock, externalRpcNodeLatestBlock,
            subgraphData, network)
        if (errorMessages.length > 0) {
            console.log(errorMessages)
            await sendMail("Alert for Indexer issue", "", JSON.stringify(errorMessages))
        } else{
            console.log(`No errors ${network}!!!`)
        }
    }
}


function getErrorMessage(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData, currentNetwork){
    // External RPC node is source of truth
    let errorMessageList = []
    let blockDiff = externalRpcNodeLatestBlock - archiveNodeLatestBlock
    if (blockDiff > process.env.BLOCK_DIFFERENCE_ALERT){
        let errorMsg = `Error archiveNodeLatestBlock ${blockDiff} block behind`
        console.log(errorMsg)
        errorMessageList.push()
    }
    let subgraphErrors = getSubgraphError(subgraphData, archiveNodeLatestBlock, currentNetwork)
    errorMessageList = errorMessageList.concat(subgraphErrors)
    return errorMessageList
}


async function sendMail(subject, htmlBody, textBody) {
    new SesClient().send(
        Constant.SESMailDetails.fromMail,
        Constant.SESMailDetails.toMails,
        subject, htmlBody, textBody
    );
}
