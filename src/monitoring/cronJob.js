import {
    MonitorIndexer
} from './monitorIndexer.js';
import Constant from './config/constants.js';
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const cron = require("node-cron");
const express = require("express");

let app = express();
console.log(`Starting monitoring at ${new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})} \ 
            with difference threshold ${process.env.BLOCK_DIFFERENCE_ALERT}`);
MonitorIndexer.monitoringIndexer().then(() =>
    console.log(`Run completed at ${new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})}`)
)

cron.schedule(Constant.cronJobSchedule, () => {
    MonitorIndexer.monitoringIndexer().then(() =>
        console.log(`Run completed at ${new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})}`))
});

app.listen(3000);
