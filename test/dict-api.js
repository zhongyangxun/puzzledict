import 'dotenv/config'; // 需要放在最前面，因为后续引入的文件可能依赖环境变量
import { parseArgs, styleText } from 'node:util';
import { postJson, REQUEST_TIMEOUT_MS } from '../src/service/api-client.js';
import { DICT_DEV_URL, DICT_PROD_URL } from '../src/lib/api.js';

console.log('dict-api 测试开始');

const { values } = parseArgs({
  options: {
    text: {
      type: 'string',
      short: 't',
    },
    prod: {
      type: 'boolean',
      short: 'p',
      default: false,
    },
    'no-signature': {
      type: 'boolean',
      short: 's',
      default: false,
    },
    'timeout-ms': {
      // `parseArgs` 不支持 number 类型，所以用 string 类型
      type: 'string',
      short: 'w',
      default: String(REQUEST_TIMEOUT_MS),
    },
  },
});

const {
  text,
  prod,
  'no-signature': noSignature,
  'timeout-ms': timeoutMsRaw,
} = values;

const timeoutMs = Number(timeoutMsRaw);

if (!text) {
  console.error('请传入要查询的单词: -t <单词>');
  process.exit(1);
}

const url = prod ? DICT_PROD_URL : DICT_DEV_URL;

const handleRequest = ({ method, url, headers, body }) => {
  const signed = Boolean(headers['X-Signature']);

  console.log(
    styleText('cyan', '→'),
    styleText('bold', method),
    styleText('blue', url),
  );

  console.log(' ', styleText('gray', 'body:'), styleText('yellow', body));

  console.log(
    ' ',
    styleText('gray', 'clientId:'),
    styleText('green', headers['X-Client-Id']),
    styleText('gray', signed ? ' (已签名)' : ' (未签名)'),
  );

  console.log(
    ' ',
    styleText('gray', 'headers:'),
    styleText('yellow', JSON.stringify(headers, null, 2)),
  );
};

const response = await postJson(
  url,
  { lookup_key: text },
  {
    disableSignature: noSignature,
    clientId: 'test',
    onRequest: handleRequest,
    timeoutMs,
  },
);

const isFetchResponse = typeof response.json === 'function';
const status = response.status;
const statusText = isFetchResponse ? response.statusText : response.message;
const data = isFetchResponse ? await response.json() : response.data;

console.log('\n');
console.log(
  styleText('cyan', '←'),
  styleText('bold', status.toString()),
  styleText(status < 300 ? 'green' : 'red', statusText),
);
console.log(
  ' ',
  styleText('gray', 'data:'),
  styleText('yellow', JSON.stringify(data, null, 2)),
);
