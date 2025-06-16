import { JsonRpcRequest, JsonRpcResponse } from '../types/Types';

export class NodeSyncMonitor {
    private localNodeUrl: string;
    private publicNodeUrl: string;
    private nodeName: string;
    private webhookUrl: string;
    private blockThreshold: number;
    private retryDelay: number; // in milliseconds

    constructor() {
        this.localNodeUrl = process.env.LOCAL_NODE_URL || "";
        this.publicNodeUrl = process.env.PUBLIC_NODE_URL || "";
        this.nodeName = process.env.NODE_NAME || "Unknown Node";
        this.blockThreshold = parseInt(process.env.BLOCK_THRESHOLD || "100", 10);
        this.retryDelay = parseInt(process.env.RETRY_DELAY || "300000", 10); // 5 minutes in milliseconds

        // Validate required environment variables
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) {
            throw new Error("DISCORD_WEBHOOK_URL environment variable is required");
        }
        if (!this.localNodeUrl) {
            throw new Error("LOCAL_NODE_URL environment variable is required");
        }
        if (!this.publicNodeUrl) {
            throw new Error("PUBLIC_NODE_URL environment variable is required");
        }
        
        this.webhookUrl = webhookUrl;
    }

    async perform(): Promise<void> {
        await this.monitorNodeSync();
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

    private async sendDiscordAlert(localBlock: number, publicBlock: number): Promise<void> {
        const delay = publicBlock - localBlock;
        const content = `⚠️ ${this.nodeName} node is behind by ${delay} blocks.\n` +
                       `Local block: ${localBlock}\n` +
                       `Public block: ${publicBlock}`;

        try {
            await this.sendWebhookMessage(content);
            console.log("NodeSyncMonitor::sendDiscordAlert::Alert sent to Discord");
        } catch (error) {
            console.error("NodeSyncMonitor::sendDiscordAlert::Failed to send Discord alert:", error);
        }
    }

    private async sendNodeDownAlert(): Promise<void> {
        const content = `🚫 ALERT: ${this.nodeName} node is **unreachable** after retry. Node might be **down**.`;

        try {
            await this.sendWebhookMessage(content);
            console.log("NodeSyncMonitor::sendNodeDownAlert::Node down alert sent to Discord");
        } catch (error) {
            console.error("NodeSyncMonitor::sendNodeDownAlert::Failed to send Discord alert:", error);
        }
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async monitorNodeSync(): Promise<void> {
        try {
            // Get local block number
            let localBlock;
            let retryCount = 3;
            while(retryCount > 0) {
                console.log(`NodeSyncMonitor::monitorNodeSync::Getting latest block from url ${this.localNodeUrl}. Retry remaining ${retryCount}`);
                localBlock = await this.getLatestBlock(this.localNodeUrl);
                if (localBlock === null) {
                    await this.sleep(this.retryDelay);
                    retryCount--;
                } else {
                    break;
                }
            }

            // Get public block number
            let publicBlock;
            let publicRetryCount = 3;
            while(publicRetryCount > 0) {
                console.log(`NodeSyncMonitor::monitorNodeSync::Getting latest block from url ${this.publicNodeUrl}. Retry remaining ${publicRetryCount}`);
                publicBlock = await this.getLatestBlock(this.publicNodeUrl);
                if (publicBlock === null) {
                    await this.sleep(this.retryDelay);
                    publicRetryCount--;
                } else {
                    break;
                }
            }

            // Send alert if either node is unreachable
            if (localBlock === null) {
                await this.sendNodeDownAlert();
                return;
            }

            if (publicBlock === null) {
                const content = `🚫 ALERT: Public node is unreachable after ${3} retry attempts. Cannot perform sync check.`;
                await this.sendWebhookMessage(content);
                return;
            }

            console.log(`NodeSyncMonitor::monitorNodeSync::Local block: ${localBlock}, Public block: ${publicBlock}`);

            // Check if node is behind by more than threshold
            if (publicBlock - localBlock > this.blockThreshold) {
                await this.sendDiscordAlert(localBlock, publicBlock);
            } else {
                console.log("NodeSyncMonitor::monitorNodeSync::Node is synced within acceptable range.");
            }
        } catch (error) {
            console.error("NodeSyncMonitor::monitorNodeSync::Failed:", error);
        }
    }
} 
