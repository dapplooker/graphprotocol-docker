import {
    DataToMonitorStatus
} from './getStatus.js';
import {createRequire} from "module";
import {SesClient} from "./emailClient.js"
import Constant from './config/constants.js';


const require = createRequire(import.meta.url);
const fullConfig = require('./config/config.json');
let allNetworkIndexer = fullConfig['network_index']


class MonitorIndexer {
    async monitoringIndexer() {
        for (const [network, config] of Object.entries(allNetworkIndexer)) {
            console.log(`========= Starting monitoring ${network} =========`)
            console.log(`Config provided ${JSON.stringify(config)}`);
            let graphIndexerNode = config['graph_indexer_node'];
            let archiveNode = config['archive_node'];
            let externalRpcNode = config['external_rpc_node'];
            if (!(archiveNode && externalRpcNode && graphIndexerNode)) {
                console.log(`Detail missing for ${network} in config, please check and update`);
                continue;
            }

            // Get all data required from archive/external RPC node and subgraph data
            let DataToMonitorStatusObj = new DataToMonitorStatus();
            let archiveNodeLatestBlock = await DataToMonitorStatusObj.getLatestBlockNumber(archiveNode, network);
            let externalRpcNodeLatestBlock = await DataToMonitorStatusObj.getLatestBlockNumber(externalRpcNode, network);
            let subgraphData = await DataToMonitorStatusObj.getSubgraphData(graphIndexerNode);
            this.checkForErrors(externalRpcNodeLatestBlock, archiveNodeLatestBlock, subgraphData, network)
        }
    }

    checkForErrors(externalRpcNodeLatestBlock, archiveNodeLatestBlock, subgraphData, network){
        if (externalRpcNodeLatestBlock === 0 || archiveNodeLatestBlock === 0) {
            let errorMsg = `Unable to communicate to archive or external RPC node of ${network}, \
                block numbers ${archiveNodeLatestBlock} ${externalRpcNodeLatestBlock} respectively.`;
            console.log(errorMsg)
            this.sendMail(`Alert - ${network} Node not accessible `, errorMsg);
        } else {
            this.getErrorMessageAndSendMail(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData, network);
        }
    }

    getErrorMessageAndSendMail(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData, currentNetwork) {
        // External RPC node is source of truth
        let blockDiff = Math.abs(externalRpcNodeLatestBlock - archiveNodeLatestBlock);
        if (blockDiff > process.env.BLOCK_DIFFERENCE_ALERT) {
            let errorMsg = `Error archiveNodeLatestBlock ${blockDiff} block behind`;
            console.log(errorMsg);
            let errorMail = `Error archiveNode ${blockDiff} block behind \n
                        Network: ${currentNetwork} \n
                        Archive Node Endpoint: ${archiveNodeLatestBlock} \n
                        Expected Block Number: ${externalRpcNodeLatestBlock} \n
                        Lagging Block Number: ${blockDiff}`
            this.sendMail(`Alert - RPC node for ${currentNetwork} is lagging behind`, errorMail);
        }
        let DataToMonitorStatusObj = new DataToMonitorStatus();
        let subgraphErrors = DataToMonitorStatusObj.getSubgraphError(subgraphData,
            archiveNodeLatestBlock, currentNetwork);
        if (subgraphErrors.length > 0){
            this.sendMail(`Alert - Subgraph error for ${currentNetwork}.`, JSON.stringify(subgraphErrors));
        }
    }

    sendMail(subject, mailBody) {
        new SesClient().send(
            Constant.SESMailDetails.fromMail,
            Constant.SESMailDetails.toMails,
            subject, mailBody, mailBody
        );
    }
}

export default new MonitorIndexer()
