import {
    DataToMonitorStatus
} from './getStatus.js';
import { createRequire } from "module";
import { SesClient } from "./emailClient.js"
import Constant from './config/constants.js';

const require = createRequire(import.meta.url);
const fullConfig = require('./config/config.json');
let allNetworkIndexer = fullConfig['network_index'];


class MonitorIndexer {
    async monitoringIndexer() {
        for (const [network, config] of Object.entries(allNetworkIndexer)) {
            console.log(`========= Starting monitoring ${network} =========`);
            console.log(`Config provided ${JSON.stringify(config)}`);
            const { graph_indexer_node: graphIndexerNode, archive_node: archiveNode, external_rpc_node: externalRpcNode } = config;
            if (!(archiveNode && externalRpcNode && graphIndexerNode)) {
                console.log(`Detail missing for ${network} in config, please check and update`);
                continue;
            }
            //check disc capacity 
            if (config['checkList']['check_disc_capacity']) {
                await this.checkDiskCapacity(network);
            }

            // Creating  DataToMonitorStatusObj instance
            const DataToMonitorStatusObj = new DataToMonitorStatus();

            // Check if Graph node is up
            if (config['checkList']['check_if_graph_node_up']) {
                if (DataToMonitorStatusObj.checkIfGraphNodeUP(graphIndexerNode)) {
                    console.log("*****graph node is up****");
                } else {
                    const errorMail = `Error archiveNode ${network} Graph node is not up \nNetwork: ${network} \nGraph Node provided: ${graphIndexerNode}`;
                    this.sendMail(`Alert - Graph node for ${currentNetwork} is down`, errorMail);
                    console.log("*******NO, graph node not working*******");
                }
            }

            // Get all data required from archive/external RPC node and subgraph data
            let [archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData] = [null, null, null];
            if (config['checkList']['check_head_block']) {
                // Get the latest blocks only if `check_head` is true
                archiveNodeLatestBlock = await DataToMonitorStatusObj.getLatestBlockNumber(archiveNode, network);
                externalRpcNodeLatestBlock = await DataToMonitorStatusObj.getLatestBlockNumber(externalRpcNode, network);
            }

            if (config['checkList']['check_subgraph_data']) {
                subgraphData = await DataToMonitorStatusObj.getSubgraphData(graphIndexerNode);
            }

            // check for errors
            this.checkForErrors(externalRpcNodeLatestBlock, archiveNodeLatestBlock, subgraphData, network, config['checkList']);
        }
    }


    checkForErrors(externalRpcNodeLatestBlock, archiveNodeLatestBlock, subgraphData = null, network, checkList) {
        if (checkList['check_head_block'] && (externalRpcNodeLatestBlock === 0 || archiveNodeLatestBlock === 0)) {
            let errorMsg = "";
            let notReachableNodeName = "";
            if (externalRpcNodeLatestBlock === 0) {
                notReachableNodeName = "external RPC node";
                errorMsg = `Unable to communicate to external RPC node of ${network}.`;
            } else {
                notReachableNodeName = "archive node";
                errorMsg = `Unable to communicate to archive node of ${network}.`;
            }
            this.sendMail(`Alert - ${network} ${notReachableNodeName} not accessible `, errorMsg);
        } else {
            this.getErrorMessageAndSendMail(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData, network, checkList);
        }
    }

    getErrorMessageAndSendMail(archiveNodeLatestBlock, externalRpcNodeLatestBlock, subgraphData = null, currentNetwork, checkList) {
        // External RPC node is source of truth
        if (checkList["check_head_block"]) {
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
        }
        let DataToMonitorStatusObj = new DataToMonitorStatus();
        if (checkList['check_subgraph_data']) {
            let subgraphErrors = DataToMonitorStatusObj.getSubgraphError(subgraphData,
                archiveNodeLatestBlock, currentNetwork);
            if (subgraphErrors.length > 0) {
                this.sendMail(`Alert - Subgraph error for ${currentNetwork}.`, JSON.stringify(subgraphErrors));
            }
        }
    }

    sendMail(subject, mailBody) {
        new SesClient().send(
            Constant.SESMailDetails.fromMail,
            Constant.SESMailDetails.toMails,
            subject, mailBody, mailBody
        );
    }

    async checkDiskCapacity(network) {
        // Creating  DataToMonitorStatusObj instance
        let DataToMonitorStatusObj = new DataToMonitorStatus();
        // get disc capacity
        const discCapacity = await DataToMonitorStatusObj.getDiscCapacity(network);
        // Compare the disk size with the alert constant
        if (discCapacity < process.env.DISC_CAPACITY_ALERT) {
            let errorMail = `Error archiveNode low disk capacity ${diskSize}\nNetwork: ${network}`;
            this.sendMail(`Alert - RPC node for ${network} is lacking disk space`, errorMail);
        }
    }

}

export default new MonitorIndexer()
