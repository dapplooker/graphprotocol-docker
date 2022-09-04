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
        let errorMessages = []
        if (!(archiveNode && externalRpcNode && graphIndexerNode)) {
            console.log(`Detail missing for ${network} in config, please check and update`)
            continue
        }

        // Get all data required from archive/external RPC node and subgraph data
        let archiveNodeLatestBlock = await getLatestBlockNumber(archiveNode, network)
        let externalRpcNodeLatestBlock = await getLatestBlockNumber(externalRpcNode, network)
        let subgraphData = await getSubgraphData(graphIndexerNode)

        if (externalRpcNodeLatestBlock === 0 || archiveNodeLatestBlock === 0){
            let errorMsg = `Unable to communicate to archive or external RPC node, \
                block numbers ${archiveNodeLatestBlock} ${externalRpcNodeLatestBlock} respectively.`
            errorMessages.push(errorMsg)
        } else {
            let errorResponse = getErrorMessage(archiveNodeLatestBlock, externalRpcNodeLatestBlock,
                subgraphData, network)
            errorMessages.concat(errorResponse)
        }
        if (errorMessages.length > 0) {
            console.log(`Found error in indexer, sending mail`)
            let mailBody = JSON.stringify(errorMessages)
            await sendMail("Alert for Indexer issue", mailBody, mailBody)
        } else{
            console.log(`No errors ${network}!!!`)
        }
    }
}


function getErrorMessage(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData, currentNetwork){
    // External RPC node is source of truth
    let errorMessageList = []
    let blockDiff = Math.abs(externalRpcNodeLatestBlock - archiveNodeLatestBlock)
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
