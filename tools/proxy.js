var port = 8001;

require("http-proxy").createProxyServer({
  target: "http://localhost/"
}).listen(port);

console.log("Proxy listening @ port " + port);
