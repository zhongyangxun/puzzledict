import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from '../api-client.js';
import {
  NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../../lib/result-messages.js';
import { getTranslateCache, setTranslateCache } from './cache';

const API_URL = 'http://127.0.0.1:8787/translate';

const getMessage = (status) => {
  switch (status) {
    case 200:
      return TRANSLATE_SUCCESS_MESSAGE;
    case 422:
      return NOT_FOUND_MESSAGE;
    case 429:
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
