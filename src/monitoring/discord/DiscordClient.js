import fetch from 'node-fetch';

export class DiscordClient {
    constructor() {
        this.webHookUrl = process.env.DISCORD_WEBHOOK_URL;
    }

    /**
     * Sends an alert to Discord when disk usage exceeds the threshold.
     * @param {string} message - The alert message to send.
     */
    async sendAlert(message) {
        if (!this.webHookUrl) {
            console.error("Discord webhook URL is not set.");
            return;
        }
        console.log('Sending Discord alert...');
    
        try {
            const response = await fetch(this.webHookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ content: message })
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send alert: ${response.status} - ${errorText}`);
            }
            console.log("✅ Alert sent to Discord!");
        } catch (error) {
            console.error("Error sending Discord alert:", error);
        }
    }
    
}
