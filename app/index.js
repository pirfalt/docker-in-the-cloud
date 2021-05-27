const http = require("http");

// Print env
console.log(JSON.stringify(process.env, null, 2));

// Create server
const server = http.createServer((req, res) => {
  printReq(req);
  res.end("Hello world!\r\n");
});

// Start server
server.listen(process.env.PORT ?? 8000, () => {
  console.log(`Listening on: ${JSON.stringify(server.address())}`);
});

// -----

// Helper
function printReq(req) {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url}` +
      `\n  ${JSON.stringify(req.headers)}`
  );
}
