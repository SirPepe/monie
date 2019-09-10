const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const serveStatic = require("serve-static");
const webPush = require("web-push");

webPush.setGCMAPIKey(fs.readFileSync("secrets/gcmkey", { encoding: "utf-8" }),);
webPush.setVapidDetails(
  "mailto:peter@peterkroener.de",
  "BJA61PkUXQzJPj22WQs7C8Vrqu20YKFDEahjbYvs7E4LoyxZHabDTP_NgBxA1PGhJjyM8Le9RNZ_lqygcodNEiQ",
  fs.readFileSync("secrets/privatekey", { encoding: "utf-8" }),
);

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

fs.watchFile(ratesSource, () => {
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
