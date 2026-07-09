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
        // Generic, safe cleanup. Each command targets reclaimable caches,
        // rotated/compressed logs or runtime temp files only, so nothing an
        // application needs at runtime is removed. Commands run independently
        // so a failure or a path missing on a given server never blocks the rest.
        const cleanupCommands: string[] = [
            // Trim the systemd journal to a small retained window.
            "journalctl --vacuum-size=200M || true",
            "journalctl --vacuum-time=3d || true",
            // Remove rotated / compressed logs (foo.gz, foo.1, foo.old, foo.log.2 ...).
            "find /var/log -type f -regextype posix-extended -regex '.*\\.(gz|old|xz|[0-9]+)$' -delete || true",
            // Empty the current syslog.1 in place instead of padding it to a fixed size.
            "truncate -s 0 /var/log/syslog.1 2>/dev/null || true",
            // Truncate running Docker container logs without stopping the containers.
            "truncate -s 0 /var/lib/docker/containers/*/*-json.log 2>/dev/null || true",
            // Drop dangling Docker images and build cache (never tagged or in use).
            "command -v docker >/dev/null 2>&1 && docker image prune -f || true",
            "command -v docker >/dev/null 2>&1 && docker builder prune -f || true",
            // Package-manager caches, re-downloaded on demand.
            "apt-get clean || true",
            "npm cache clean --force || true",
            // Stale Chromium / Puppeteer temp profiles and old temp files.
            "rm -rf /tmp/puppeteer_dev_* /tmp/.org.chromium.Chromium.* /tmp/.com.google.Chrome.* 2>/dev/null || true",
            "find /tmp -mindepth 1 -type f -atime +3 -delete 2>/dev/null || true",
        ];

        for (const command of cleanupCommands) {
            try {
                execSync(command, { stdio: "pipe" });
            } catch (error) {
                console.error(`DiskSpaceAlert::deleteLogFiles::Command failed: ${command}`, error);
            }
        }

        console.log("DiskSpaceAlert::deleteLogFiles::Cleanup commands executed.");
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
