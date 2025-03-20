import { exec } from "child_process";
import { DiscordBotManager } from "../discord/DiscordBotManager";

export class DiskSpaceAlert {
    private discordBot = DiscordBotManager.getBotInstance();
    private threshold = parseInt(process.env.DISC_CAPACITY_ALERT || "90", 10);

    async perform(): Promise<void> {
        await this.checkDiskSpace();
    }

    private async checkDiskSpace(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const oThis = this;
            const ids = process.env.DISCORD_USER_ID_TAGS;
            exec("df -h / | awk 'NR==2 {print $2, $3, $4, $5}'", async (error, stdout, stderr) => {
                if (error || stderr) {
                    console.error("DiskSpaceAlert::checkDiskSpace::Error checking disk space:", error || stderr);
                    return reject(error || stderr);
                }

                if (!stdout) {
                    console.error("DiskSpaceAlert::checkDiskSpace::No output received from disk check command.");
                    return reject(new Error("No output from disk check"));
                }

                const [totalSpace, usedSpace, availableSpace, usedPercentageStr] = stdout.trim().split(/\s+/);
                const usedPercentage = parseInt(usedPercentageStr.replace("%", ""), 10);
                const hostname = process.env.HOST_NAME;

                console.log(`DiskSpaceAlert::checkDiskSpace::Parsed Disk Usage: ${usedPercentage}%`);

                if (usedPercentage > this.threshold) {
                    const formattedIds = oThis.formatDiscordMentions(ids)
                    const alertMessage = `🚨 **ALERT: High Disk Usage Detected!** 🚨\n\n` +
                        `*Server:* **${hostname}**\n` +
                        `*Disk Usage:* **${usedPercentage}%**\n` +
                        `*Total Space:* **${totalSpace}**\n` +
                        `*Used Space:* **${usedSpace}**\n` +
                        `*Available Space:* **${availableSpace}**\n\n` +
                        `⚠️ **Please take action to free up space immediately!**` +
                        `${formattedIds ? `\ncc: ${formattedIds}` : `""`}\n\n` +
                        `For cleanup guidelines, refer to: **[Space Cleanup Checklist](https://github.com/dapplooker/devops/blob/main/src/devops/space-cleanup.md#space-cleanup-checklist)**`;

                    console.log(`DiskSpaceAlert::checkDiskSpace::${JSON.stringify(alertMessage)}`);
                    await this.discordBot.sendAlert(alertMessage);

                    // Cleaning disk
                    oThis.deleteLogFiles()
                } else {
                    console.log(`DiskSpaceAlert::checkDiskSpace::Disk usage is normal: ${usedPercentage}%`);
                }
                resolve();
            });
        });
    }

    private formatDiscordMentions(ids: string): string {
        if (!ids) {
            console.error("DiskSpaceAlert::checkDiskSpace: No id received");
            return "";
        }

        return ids
            .split(",")
            .map(id => `<@${id.trim()}>`)
            .join(" ");
    }

    private deleteLogFiles(): void {
        try {
            exec("rm -f /var/log/syslog.*");
            exec("npm cache clean --force");
            console.log("DiskSpaceAlert::deleteLogFiles::Old syslog files deleted.");
        } catch (error) {
            console.error("Failed to delete log files:", error);
        }
    }
}
