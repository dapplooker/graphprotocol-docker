import {
    monitoringIndexer
} from './monitorIndexer.js';
import {createRequire} from "module";

const require = createRequire(import.meta.url);
const cron = require("node-cron");
const express = require("express");

let app = express();

// Creating a cron job which runs on every 10 second
cron.schedule("*/10 * * * * *", () => {
    monitoringIndexer().then(() => console.log(`Run completed at ${new Date().toLocaleString()}`))
});

app.listen(3000);
