import { Client, GatewayIntentBits, TextChannel } from "discord.js";

export class DiscordBot {
    private client: Client;
    private token: string;
    private channelId: string;

    constructor(token: string, channelId: string) {
        this.token = token;
        this.channelId = channelId;
        this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    }

    /**
     * Logs in and sends a message to the specified Discord channel.
     * @param message - The message to send.
     */
    async sendAlert(message: string): Promise<void> {
        try {
            await this.client.login(this.token);
            const channel = await this.client.channels.fetch(this.channelId);

            if (!channel || !(channel instanceof TextChannel)) {
                console.error("DiscordBot::sendAlert::Invalid channel ID. Make sure the bot has access.");
                return;
            }

            await channel.send(message);
            console.log("DiscordBot::sendAlert::Alert sent to Discord successfully!");
        } catch (error) {
            console.error("DiscordBot::sendAlert::Error sending Discord alert:", error);
        } finally {
            this.client.destroy();
        }
    }
}
