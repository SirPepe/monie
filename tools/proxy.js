require("http-proxy").createProxyServer({
  target: "http://localhost/~peter/OpenSource/Monie/"
}).listen(8001);
