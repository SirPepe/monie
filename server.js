const fs = require("fs");
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const serveStatic = require("serve-static");
const webPush = require("web-push");

webPush.setGCMAPIKey(process.argv[process.argv.length - 1] || null);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(serveStatic("./", { index: [ "index.html" ] }));

const ratesSource = "./api/latest.json";
let subscriptionInfo = null;

app.post("/push-register", (req, res) => {
  console.log("Registering:", req.body);
  const { key, authSecret, endpoint } = req.body;
  if (key && authSecret && endpoint) {
    subscriptionInfo = { key, authSecret, endpoint };
    res.sendStatus(201);
  } else {
    res.sendStatus(400);
  }
});

app.listen(3000, () => console.log("Server listening @ port 3000") );

fs.watchFile(ratesSource, (current) => {
  console.log("New rates detected...");
  if (subscriptionInfo) {
    console.log("Sending push message...");
    webPush.sendNotification({
      endpoint: subscriptionInfo.endpoint,
      keys: {
        p256dh: subscriptionInfo.key,
        auth: subscriptionInfo.authSecret
      }
    }, JSON.stringify({ type: "NEW_RATES" }))
    .then(
      () => console.log("Push message sent!"),
      (err) => console.log("Failed to push:", err)
    );
  }
});
