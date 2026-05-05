export function initLogger() {
  // 仅在开发模式下生效（基于构建工具的环境变量）
  if (process.env.NODE_ENV !== 'development') return;
  const nativeLog = console.log;
  console.log = (...args) => {
    nativeLog(...args);
    log(...args);
  };
}

function log(...args) {
  // 端口号需与 scripts/remote-log-server.js 中 LOG_SERVER_PORT 一致
  // 此处不从 scripts/remote-log-server.js 中引入，避免将 log 服务端 node 代码耦合到前端业务代码中
  fetch('http://localhost:9876', {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(args),
  }).catch(() => {
    // 忽略 server 未启动时的报错，避免报错干扰正常输出
  });
}
