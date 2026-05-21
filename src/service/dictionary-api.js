import { parseJsonResponse, postJson } from '../background/api-client';
import { getCache, setCache } from './cache';

const API_URL = 'http://127.0.0.1:8789/lookup';

export async function queryDictionary(text, clientId) {
  const cache = await getCache(text);
  if (cache) {
    return {
      status: 200,
      message: '查询成功',
      data: cache,
    };
  }

  const response = await postJson(API_URL, { lookup_key: text }, { clientId });

  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );

  if (status === 200) {
    await setCache(text, data);
  }

  return { status, message, data };
}

function getMessage(status) {
  switch (status) {
    case 200:
      return '查询成功';
    case 429:
      return '请求过于频繁，请稍后再试';
    default:
      // TODO(rate-limit): distinguish 5xx from not-found (avoid misleading "未找到该单词" on server errors).
      return '未找到该单词';
  }
}
