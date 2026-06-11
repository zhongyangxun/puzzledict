import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from '../api-client.js';
import {
  DAILY_QUOTA_EXCEEDED_MESSAGE,
  NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../../lib/result-messages.js';
import { getTranslateCache, setTranslateCache } from './cache';
import { IS_DEV } from '../../lib/build-env.js';
import {
  TRANSLATE_DEV_URL,
  TRANSLATE_PROD_URL,
  DAILY_QUOTA_EXCEEDED_CODE,
} from '../../lib/api.js';

const API_URL = IS_DEV ? TRANSLATE_DEV_URL : TRANSLATE_PROD_URL;

const getMessage = (status, data) => {
  switch (status) {
    case 200:
      return TRANSLATE_SUCCESS_MESSAGE;
    case 422:
      return NOT_FOUND_MESSAGE;
    case 429:
      // 配额熔断，返回每日请求限额已用完的错误信息
      if (data?.code === DAILY_QUOTA_EXCEEDED_CODE) {
        return DAILY_QUOTA_EXCEEDED_MESSAGE;
      }
      // 限流，返回请求过于频繁的错误信息
      return RATE_LIMIT_MESSAGE;
    default:
      return TRANSLATE_FAILED_MESSAGE;
  }
};

export const translateText = async (
  text,
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS },
) => {
  const trimed = text.trim();
  const cache = await getTranslateCache(trimed);
  if (cache) {
    return {
      status: 200,
      message: TRANSLATE_SUCCESS_MESSAGE,
      data: cache,
    };
  }

  const response = await postJson(
    API_URL,
    { text: trimed },
    { clientId, timeoutMs },
  );

  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );

  if (status === 200) {
    await setTranslateCache(trimed, data);

    return { status, message, data };
  }
  return { status, message, data: null };
};
