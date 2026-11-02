import { DAILY_QUOTA_EXCEEDED_CODE, TRANSLATE_URL } from '../../lib/api.js';
import {
  DAILY_QUOTA_EXCEEDED_MESSAGE,
  NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../../lib/result-messages.js';
import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from '../api-client.js';

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
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS } = {},
) => {
  const trimed = text.trim();

  const response = await postJson(
    TRANSLATE_URL,
    { text: trimed },
    { clientId, timeoutMs },
  );

  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );

  return { status, message, data };
};
