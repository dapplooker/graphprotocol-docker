import { DiscordClient } from "../discord/DiscordClient.js";
import { exec } from "child_process";
import os from "os";

export class DiskSpaceAlert {
    constructor() {
        this.discordClient = new DiscordClient();
    }

    async perform() {
        await this.checkDiskSpace();
    }

    async checkDiskSpace() {
        return new Promise((resolve, reject) => {
            exec("df -h / | awk 'NR==2 {print $2, $3, $4, $5}'", async (error, stdout, stderr) => {
                if (error || stderr) {
                    console.error('Error checking disk space:', error || stderr);
                    return reject(error || stderr);
                }

                if (!stdout) {
                    console.error("No output received from disk check command.");
                    return reject(new Error("No output from disk check"));
                }

                const [totalSpace, usedSpace, availableSpace, usedPercentageStr] = stdout.trim().split(/\s+/);
                const usedPercentage = parseInt(usedPercentageStr.replace('%', ''), 10);
                const hostname = os.hostname();

                console.log(`Parsed Disk Usage: ${usedPercentage}%`);

                if (usedPercentage > process.env.DISC_CAPACITY_ALERT) {
                    const alertMessage = `🚨 **ALERT: High Disk Usage** 🚨\n\n` +
                        `🔴 **Server:** ${hostname}\n` +
                        `💾 **Disk Usage:** ${usedPercentage}%\n` +
                        `📦 **Total Space:** ${totalSpace}\n` +
                        `📊 **Used Space:** ${usedSpace}\n` +
                        `🟢 **Available Space:** ${availableSpace}\n` +
                        `⚠️ **Please take action to free up space!**`;

                    console.log(alertMessage);
                    await this.discordClient.sendAlert(alertMessage);
                } else {
                    console.log(`✅ Disk usage is normal: ${usedPercentage}%`);
                }
                resolve();
            });
        });
    }
}
