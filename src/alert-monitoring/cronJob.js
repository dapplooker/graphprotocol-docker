import {
    monitoringIndexer
} from './monitorIndexer.js';
import Constant from './config/constants.js';
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const cron = require("node-cron");
const express = require("express");

let app = express();
console.log(`Starting monitoring`)
monitoringIndexer().then(() => console.log(`Run completed at ${new Date().toLocaleString()}`))
console.log(process.env.BLOCK_DIFFERENCE_ALERT)

cron.schedule(Constant.cronJobSchedule, () => {
    monitoringIndexer().then(() => console.log(`Run completed at ${new Date().toLocaleString()}`))
});

app.listen(3000);
