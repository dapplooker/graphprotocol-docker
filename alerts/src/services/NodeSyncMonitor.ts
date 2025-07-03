import { JsonRpcRequest, JsonRpcResponse } from '../types/Types';

interface NodeEndpoint {
    localUrl: string;
    publicUrl: string;
    name: string;
}

export class NodeSyncMonitor {
    private nodeEndpoints: NodeEndpoint[];
    private webhookUrl: string;
    private blockThreshold: number;
    private retryDelay: number; // in milliseconds

    constructor() {
        this.blockThreshold = parseInt(process.env.BLOCK_THRESHOLD || "100", 10);
        this.retryDelay = parseInt(process.env.RETRY_DELAY || "300000", 10); // 5 minutes in milliseconds

        // Validate required environment variables
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
            throw new Error("DISCORD_WEBHOOK_URL environment variable is required");
        }
        this.webhookUrl = webhookUrl;

        // Load node endpoints
        this.nodeEndpoints = this.loadNodeEndpoints();
        
        if (this.nodeEndpoints.length === 0) {
            throw new Error("At least one LOCAL_NODE_URL and PUBLIC_NODE_URL pair is required");
        }

        console.log(`NodeSyncMonitor::constructor::Loaded ${this.nodeEndpoints.length} node endpoint(s) for monitoring`);
    }

    private loadNodeEndpoints(): NodeEndpoint[] {
        const endpoints: NodeEndpoint[] = [];

        // Load indexed environment variables
        let index = 1;
        while (true) {
            const localUrl = process.env[`LOCAL_NODE_URL_${index}`];
            const publicUrl = process.env[`PUBLIC_NODE_URL_${index}`];
            const nodeName = process.env[`NODE_NAME_${index}`] || `Node ${index}`;

            if (!localUrl || !publicUrl) {
                break; // No more indexed URLs found
            }

            endpoints.push({
                localUrl: localUrl.trim(),
                publicUrl: publicUrl.trim(),
                name: nodeName.trim()
            });
            index++;
        }

        // Log loaded endpoints
        endpoints.forEach((endpoint, index) => {
            console.log(`NodeSyncMonitor::loadNodeEndpoints::Endpoint ${index + 1}: ${endpoint.name} (Local: ${endpoint.localUrl}, Public: ${endpoint.publicUrl})`);
        });

        return endpoints;
    }

    async perform(): Promise<void> {
        await this.monitorMultipleNodes();
    }

    private async sendWebhookMessage(content: string): Promise<boolean> {
        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) {
                console.error(`NodeSyncMonitor::sendWebhookMessage::HTTP Error: ${response.status} ${response.statusText}`);
                return false;
            }

            console.log('NodeSyncMonitor::sendWebhookMessage::Message sent successfully');
            return true;
        } catch (error) {
            console.error('NodeSyncMonitor::sendWebhookMessage::Failed to send webhook message:', error);
            return false;
        }
    }

    private async getLatestBlock(nodeUrl: string): Promise<number | null> {
        const payload: JsonRpcRequest = {
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1
        };

        try {
            const response = await fetch(nodeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as JsonRpcResponse;
            
            if (data.error) {
                throw new Error(`JSON-RPC Error: ${JSON.stringify(data.error)}`);
            }

            const blockHex = data.result || "0x0";
            return parseInt(blockHex, 16);
        } catch (error) {
            console.error(`NodeSyncMonitor::getLatestBlock::Error connecting to node at ${nodeUrl}:`, error);
            return null;
        }
    }

    private async sendDiscordAlert(localBlock: number, publicBlock: number, nodeName: string): Promise<void> {
        const delay = publicBlock - localBlock;
        const content = `⚠️ **${nodeName}** node is behind by **${delay}** blocks.\n` +
                       `Local block: ${localBlock}\n` +
                       `Public block: ${publicBlock}`;

        try {
            await this.sendWebhookMessage(content);
            console.log(`NodeSyncMonitor::sendDiscordAlert::Alert sent to Discord for ${nodeName}`);
        } catch (error) {
            console.error(`NodeSyncMonitor::sendDiscordAlert::Failed to send Discord alert for ${nodeName}:`, error);
        }
    }

    private async sendNodeDownAlert(nodeName: string, nodeUrl: string): Promise<void> {
        const content = `🚫 ALERT: **${nodeName}** node is **unreachable** after retry. Node might be **down**.\n` +
                       `RPC URL: ${nodeUrl}`;

        try {
            await this.sendWebhookMessage(content);
            console.log(`NodeSyncMonitor::sendNodeDownAlert::Node down alert sent to Discord for ${nodeName}`);
        } catch (error) {
            console.error(`NodeSyncMonitor::sendNodeDownAlert::Failed to send Discord alert for ${nodeName}:`, error);
        }
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async getLatestBlockWithRetry(nodeUrl: string, nodeType: string, nodeName: string): Promise<number | null> {
        let block;
        let retryCount = 3;
        while(retryCount > 0) {
            console.log(`NodeSyncMonitor::getLatestBlockWithRetry::Getting latest block from ${nodeType} node ${nodeUrl} for ${nodeName}. Retry remaining ${retryCount}`);
            block = await this.getLatestBlock(nodeUrl);
            if (block === null) {
                await this.sleep(this.retryDelay);
                retryCount--;
            } else {
                break;
            }
        }
        return block;
    }

    private async monitorMultipleNodes(): Promise<void> {
        console.log(`NodeSyncMonitor::monitorMultipleNodes::Starting monitoring for ${this.nodeEndpoints.length} node endpoint(s)...`);
        
        const results = [];
        
        // Process all node endpoints concurrently
        for (const endpoint of this.nodeEndpoints) {
            console.log(`NodeSyncMonitor::monitorMultipleNodes::Processing ${endpoint.name}`);
            results.push(this.monitorSingleNodeEndpoint(endpoint));
        }

        // Wait for all monitoring tasks to complete
        const monitoringResults = await Promise.allSettled(results);
        
        // Log results summary
        let successCount = 0;
        let failureCount = 0;
        
        monitoringResults.forEach((result, index) => {
            const endpointName = this.nodeEndpoints[index].name;
            if (result.status === 'fulfilled') {
                console.log(`NodeSyncMonitor::monitorMultipleNodes::Successfully monitored ${endpointName}`);
                successCount++;
            } else {
                console.error(`NodeSyncMonitor::monitorMultipleNodes::Failed to monitor ${endpointName}, Error: ${result.reason}`);
                failureCount++;
            }
        });

        console.log(`NodeSyncMonitor::monitorMultipleNodes::Monitoring completed. Success: ${successCount}, Failures: ${failureCount}`);
    }

    private async monitorSingleNodeEndpoint(endpoint: NodeEndpoint): Promise<void> {
        try {
            console.log(`NodeSyncMonitor::monitorSingleNodeEndpoint::Starting sync check for ${endpoint.name}`);

            // Get local block number
            const localBlock = await this.getLatestBlockWithRetry(endpoint.localUrl, "local", endpoint.name);

            // Get public block number
            const publicBlock = await this.getLatestBlockWithRetry(endpoint.publicUrl, "public", endpoint.name);

            // Send alert if either node is unreachable
            if (localBlock === null) {
                await this.sendNodeDownAlert(endpoint.name, endpoint.localUrl);
                return;
            }

            if (publicBlock === null) {
                const content = `🚫 ALERT: Public node is unreachable for **${endpoint.name}** after 3 retry attempts. Cannot perform sync check.\n` +
                               `RPC URL: ${endpoint.publicUrl}`;
                await this.sendWebhookMessage(content);
                return;
            }

            console.log(`NodeSyncMonitor::monitorSingleNodeEndpoint::${endpoint.name} - Local block: ${localBlock}, Public block: ${publicBlock}`);

            // Check if node is behind by more than threshold
            if (publicBlock - localBlock > this.blockThreshold) {
                await this.sendDiscordAlert(localBlock, publicBlock, endpoint.name);
            } else {
                console.log(`NodeSyncMonitor::monitorSingleNodeEndpoint::${endpoint.name} is synced within acceptable range.`);
            }
        } catch (error) {
            console.error(`NodeSyncMonitor::monitorSingleNodeEndpoint::Failed for ${endpoint.name}:`, error);
            throw error;
        }
    }
} 
