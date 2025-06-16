import { NodeSyncMonitor } from "../services/NodeSyncMonitor";
import config from "../config.json";

class NodeSyncMonitorCron {
    async perform(): Promise<void> {
        console.log("NodeSyncMonitorCron::perform::Loading config...");

        if (!config) {
            console.error("NodeSyncMonitorCron::perform::Config file could not be loaded. Exiting...");
            process.exit(1);
        }

        if (config.check_node_sync) {
            console.log("NodeSyncMonitorCron::perform::Node sync check is enabled. Running...");
            await new NodeSyncMonitor().perform();
        } else {
            console.log("NodeSyncMonitorCron::perform::Node sync check is disabled in config. Skipping...");
        }
    }
}

const nodeSyncMonitorCron = new NodeSyncMonitorCron();

nodeSyncMonitorCron
    .perform()
    .then(() => {
        console.log('NodeSyncMonitorCron::perform::Process execution is completed...');
        process.exit(0);
    })
    .catch((err) => {
        console.error(
            `NodeSyncMonitorCron::error::Error occurred during execution: ${err.message}, Stacktrace: ${err.stack}`
        );
        process.exit(1);
    }); 