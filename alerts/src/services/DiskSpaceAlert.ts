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

    // Always keep at least this many minutes of logs after any cleanup.
    private readonly retainMinutes = 360; // 6 hours

    private deleteLogFiles(): void {
        // Generic, safe cleanup. Every command only removes reclaimable caches,
        // already-rotated logs, log lines older than the last 6 hours, or temp
        // files that are idle. Nothing an app needs at runtime is touched, and
        // the last 6 hours of logs always survive. Commands run independently so
        // a failure or a path missing on a given server never blocks the rest.
        const minutes = this.retainMinutes;

        // Keep only the last 6 hours of each large running container log, in place,
        // so the container keeps writing and recent logs survive. Streams with awk
        // (index/substr only, so it works under both mawk and gawk) to stay memory
        // safe on very large logs.
        const trimContainerLogs =
            "cutoff=$(date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null); [ -n \"$cutoff\" ] || exit 0; " +
            "for f in $(find /var/lib/docker/containers -name '*-json.log' -size +20M 2>/dev/null); do " +
            "t=\"$f.cleanup.tmp\"; " +
            "awk -v c=\"$cutoff\" 'BEGIN{p=\"\\\"time\\\":\\\"\"} {i=index($0,p); if(i){v=substr($0,i+8,19); if(v>=c) print}}' \"$f\" > \"$t\" 2>/dev/null " +
            "&& cat \"$t\" > \"$f\" 2>/dev/null; rm -f \"$t\"; done";

        const cleanupCommands: string[] = [
            // Trim the systemd journal to the last 2 days (well above the 6h floor).
            "journalctl --vacuum-time=2d || true",
            // Remove already-rotated / compressed logs untouched for over 6h
            // (foo.gz, foo.1, foo.old, foo.log.2 ...); recently rotated logs are kept.
            `find /var/log -type f -regextype posix-extended -regex '.*\\.(gz|old|xz|[0-9]+)$' -mmin +${minutes} -delete || true`,
            // Keep only the last 6h of each large running Docker container log.
            `${trimContainerLogs} || true`,
            // Drop dangling Docker images and build cache (never tagged or in use).
            "command -v docker >/dev/null 2>&1 && docker image prune -f || true",
            "command -v docker >/dev/null 2>&1 && docker builder prune -f || true",
            // Package-manager caches, re-downloaded on demand.
            "apt-get clean || true",
            "npm cache clean --force || true",
            // Stale Chromium / Puppeteer temp profiles idle for over 6h, so an
            // in-flight render is never removed.
            `find /tmp -maxdepth 1 \\( -name 'puppeteer_dev_*' -o -name '.org.chromium.Chromium.*' -o -name '.com.google.Chrome.*' \\) -mmin +${minutes} -exec rm -rf {} + 2>/dev/null || true`,
            // Other temp files not modified in over 3 days.
            "find /tmp -mindepth 1 -type f -mtime +3 -delete 2>/dev/null || true",
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
