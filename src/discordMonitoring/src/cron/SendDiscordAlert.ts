import { DiskSpaceAlert } from "../services/DiskSpaceAlert";
import config from "../config.json";

class SendDiscordAlert {
    async perform(): Promise<void> {
        console.log("SendDiscordAlert::perform::Loading config...");

        if (!config) {
            console.error("SendDiscordAlert::perform::Config file could not be loaded. Exiting...");
            process.exit(1);
        }

        if (config.check_disk_space) {
            console.log("SendDiscordAlert::perform::Disk space check is enabled. Running...");
            await new DiskSpaceAlert().perform();
        } else {
            console.log("SendDiscordAlert::perform::Disk space check is disabled in config. Skipping...");
        }
    }
}

const sendDiscordAlert = new SendDiscordAlert();

sendDiscordAlert
    .perform()
    .then(() => {
        console.log('SendDiscordAlert::perform::Process execution is completed...');
        process.exit(0);
    })
    .catch((err) => {
        console.error(
            `ExceptionAlerts::error::Error occurred during execution: ${err.message}, Stacktrace: ${err.stack}`
        );
        process.exit(1);
    });
