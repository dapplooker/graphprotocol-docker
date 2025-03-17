import { DiskSpaceAlert } from "../services/DiskSpaceAlert.js";
import fs from "fs";
import path from "path";

class SendDiscordAlert {
    constructor() {
        this.configPath = path.resolve("config.json");
    }

    async loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, "utf-8");
            return JSON.parse(configData);
        } catch (error) {
            console.error("Error reading config file:", error);
            return null;
        }
    }

    async perform() {
        console.log("Loading config...");
        const config = await this.loadConfig();

        if (!config) {
            console.error("Config file could not be loaded. Exiting...");
            process.exit(1);
        }

        if (config.check_disk_space) {
            console.log("Disk space check is enabled. Running...");
            await new DiskSpaceAlert().perform();
        } else {
            console.log("Disk space check is disabled in config. Skipping...");
        }
    }
}

const sendDiscordAlert = new SendDiscordAlert();

sendDiscordAlert
    .perform()
    .then(() => {
        console.log('Process execution is completed...')
        process.exit(0);
    })
    .catch((err) => {
        console.log(
            `ExceptionAlerts::error::Error occurred during execution: ${err.message}, Stacktrace: ${err.stack}`
        );
        process.exit(1);
    });
