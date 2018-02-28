const fs = require("fs");
const http = require("http");
const final = require("finalhandler");
const serveStatic = require("serve-static");

const serve = serveStatic("./", {
  index: [ "index.html" ],
});

const server = http.createServer( (req, res) => serve(req, res, final(req, res)) );
server.listen(3000, () => console.log("Server listening @ port 3000") );

fs.watchFile("./api/latest.json", () => {
  console.log("New rates detected...");
});
