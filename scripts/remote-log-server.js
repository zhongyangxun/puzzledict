import http from 'http';

const LOG_SERVER_PORT = 9876;

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (body) {
        const data = JSON.parse(body);
        console.log(`\x1b[36m[SW Log]\x1b[0m`, ...data); // 颜色标记能让日志更显眼
      }
      res.end();
    });
  })
  .listen(LOG_SERVER_PORT);

console.log(`Log server is running on port ${LOG_SERVER_PORT}`);
