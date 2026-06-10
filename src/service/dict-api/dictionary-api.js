import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from '../api-client.js';
import { getDictCache, setDictCache } from './cache';
import {
  DICT_FAILED_MESSAGE,
  DICT_SUCCESS_MESSAGE,
  NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
} from '../../lib/result-messages.js';
import { IS_DEV } from '../../lib/build-env.js';
import { DICT_DEV_URL, DICT_PROD_URL } from '../../lib/api.js';

const API_URL = IS_DEV ? DICT_DEV_URL : DICT_PROD_URL;

export async function queryDictionary(
  text,
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS },
) {
  const cache = await getDictCache(text);
  if (cache) {
    return {
      status: 200,
      message: DICT_SUCCESS_MESSAGE,
      data: cache,
    };
  }

  const response = await postJson(
    API_URL,
    { lookup_key: text },
    { clientId, timeoutMs },
  );

  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );

  if (status === 200) {
    await setDictCache(text, data);
  }

  return { status, message, data };
}

function getMessage(status) {
  switch (status) {
    case 200:
      return DICT_SUCCESS_MESSAGE;
    case 404:
      return NOT_FOUND_MESSAGE;
    case 429:
      return RATE_LIMIT_MESSAGE;
    default:
      return DICT_FAILED_MESSAGE;
  }
}
