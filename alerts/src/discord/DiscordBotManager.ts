import { DiscordBot } from "./DiscordBot";

export class DiscordBotManager {
    private static instance: DiscordBot;

    private constructor() {}

    public static getBotInstance(): DiscordBot {
        if (!this.instance) {
            const botToken = process.env.DISCORD_BOT_TOKEN || "";
            const channelId = process.env.DISCORD_CHANNEL_ID || "";

            if (!botToken || !channelId) {
                throw new Error("DiscordBotManager::getBotInstance::Missing Discord bot token or channel ID in environment variables.");
            }

            this.instance = new DiscordBot(botToken, channelId);
        }
        return this.instance;
    }
}
