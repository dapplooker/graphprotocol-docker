import { exec, execSync } from "child_process";
import { DiscordBotManager } from "../discord/DiscordBotManager";

export class DiskSpaceAlert {
    private discordBot = DiscordBotManager.getBotInstance();
    private threshold = parseInt(process.env.DISC_CAPACITY_ALERT || "90", 10);

    async perform(): Promise<void> {
        await this.checkDiskSpace();
    }

    /**
     * Execute a shell command and return the output
     */
    private executeCommand(command: string, context: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error || stderr) {
                    console.error(`DiskSpaceAlert::${context}::Error:`, error || stderr);
                    return reject(error || stderr);
                }

                if (!stdout) {
                    console.error(`DiskSpaceAlert::${context}::No output received.`);
                    return reject(new Error("No output from command"));
                }

                resolve(stdout.trim());
            });
        });
    }

    /**
     * Send an alert message to Discord
     */
    private async sendAlertMessage(message: string): Promise<void> {
        console.log(`DiskSpaceAlert::sendAlertMessage::${message}`);
        await this.discordBot.sendAlert(message);
    }

    private async checkDiskSpace(): Promise<void> {
        try {
            const ids = process.env.DISCORD_USER_ID_TAGS;
            const hostname = process.env.HOST_NAME;

            // Get initial disk space info in KB
            const initialAvailableSpaceInKb = await this.executeCommand("df -k / | awk 'NR==2 {print $4}'", "initialDiskKb");
            const initialAvailableKb = parseInt(initialAvailableSpaceInKb, 10);

            // Get initial disk space information
            const diskInfo = await this.executeCommand("df -h / | awk 'NR==2 {print $2, $3, $4, $5}'", "checkDiskSpace");
            const [totalSpace, usedSpace, availableSpace, usedPercentageStr] = diskInfo.split(/\s+/);
            const usedPercentage = parseInt(usedPercentageStr.replace("%", ""), 10);

            console.log(`DiskSpaceAlert::checkDiskSpace::Parsed Disk Usage: ${usedPercentage}%`);

            let cleanupPerformed = false;
            let newAvailableSpace = availableSpace;
            let spaceFreed = "";

            // If disk usage is above threshold, perform cleanup
            if (usedPercentage > this.threshold) {
                console.log(`DiskSpaceAlert::checkDiskSpace::Disk usage is high (${usedPercentage}%). Performing cleanup...`);

                // Perform cleanup
                this.deleteLogFiles();

                // Wait for cleanup to complete
                await new Promise(resolve => setTimeout(resolve, 3000));
                cleanupPerformed = true;

                // Get updated disk space info in KB
                const updatedAvailableSpaceInKb = await this.executeCommand("df -k / | awk 'NR==2 {print $4}'", "updatedDiskKb");
                const finalAvailableKb = parseInt(updatedAvailableSpaceInKb, 10);
                const diffKb = Math.abs(finalAvailableKb - initialAvailableKb);
                if (diffKb > 0) {
                    const freedGb = (diffKb / (1024 * 1024)).toFixed(2);
                    spaceFreed = `*Space Freed After Cleanup:* **${freedGb} GB**\n`;
                } else {
                    spaceFreed = `*Space Freed After Cleanup:* **0.00 GB**\n`;
                }
                    
                const freedGb = (diffKb / (1024 * 1024)).toFixed(2);
                spaceFreed = `*Space Freed After Cleanup:* **${freedGb} GB**\n`;

                // Get updated disk space information after cleanup
                const updatedDiskInfo = await this.executeCommand("df -h / | awk 'NR==2 {print $4}'", "postCleanupCheck");
                newAvailableSpace = updatedDiskInfo;
                const formattedIds = this.formatDiscordMentions(ids);

                // send alert AFTER cleanup
                const alertMessage = `🚨 **ALERT: High Disk Usage Detected!** 🚨\n\n` +
                    `*Server:* **${hostname}**\n` +
                    `*Initial Disk Usage:* **${usedPercentage}%**\n` +
                    `*Total Space:* **${totalSpace}**\n` +
                    `*Initial Used Space:* **${usedSpace}**\n` +
                    `*Initial Available Space:* **${availableSpace}**\n` +
                    (cleanupPerformed ? `*Available Space After Cleanup:* **${newAvailableSpace}**\n${spaceFreed}` : `\n\n`) +
                    `⚠️ **Please take action to free up space immediately!**` +
                    `${formattedIds ? `\ncc: ${formattedIds}` : ""}\n\n` +
                    `For cleanup guidelines, refer to: **[Space Cleanup Checklist](https://github.com/dapplooker/devops/blob/main/src/devops/space-cleanup.md#space-cleanup-checklist)**`;

                await this.sendAlertMessage(alertMessage);
            } else {
                console.log(`DiskSpaceAlert::checkDiskSpace::Disk usage is normal: ${usedPercentage}%`);
            }
        } catch (error) {
            console.error("DiskSpaceAlert::checkDiskSpace::Failed:", error);
        }
    }

    private formatDiscordMentions(ids: string): string {
        if (!ids) {
            console.error("DiskSpaceAlert::formatDiscordMentions::No id received");
            return "";
        }

        return ids
            .split(",")
            .map(id => `<@${id.trim()}>`)
            .join(" ");
    }

    private deleteLogFiles(): void {
        try {
            // Execute cleanup commands while waiting for results
            execSync("journalctl --vacuum-size=500M");
            execSync("rm -rf /var/log/*.gz");
            execSync("npm cache clean --force");
            console.log("DiskSpaceAlert::deleteLogFiles::Old syslog files deleted.");
        } catch (error) {
            console.error("DiskSpaceAlert::deleteLogFiles::Failed to delete log files:", error);
        }
    }

    private async checkDiskSpaceAfterCleanup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            exec("df -h / | awk 'NR==2 {print $4}'", async (error, stdout, stderr) => {
                if (error || stderr) {
                    console.error("DiskSpaceAlert::checkDiskSpaceAfterCleanup::Error:", error || stderr);
                    return reject(error || stderr);
                }
    
                if (!stdout) {
                    console.error("DiskSpaceAlert::checkDiskSpaceAfterCleanup::No output received.");
                    return reject(new Error("No output from disk check"));
                }
    
                const availableSpace = stdout.trim();
                const message = `*Available space after cleanup:* **${availableSpace}**`;
    
                console.log(`DiskSpaceAlert::checkDiskSpaceAfterCleanup::${message}`);
                await this.discordBot.sendAlert(message);
    
                resolve();
            });
        });
    }
    
    
}
