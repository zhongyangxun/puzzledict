import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from './api-client.js';
import {
  NOT_FOUND_MESSAGE,
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../lib/translate-messages.js';

const API_URL = 'http://127.0.0.1:8787/translate';

const getMessage = (status) => {
  switch (status) {
    case 200:
      return TRANSLATE_SUCCESS_MESSAGE;
    case 422:
      return NOT_FOUND_MESSAGE;
    default:
      return TRANSLATE_FAILED_MESSAGE;
  }
};

export const translateText = async (
  text,
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS },
) => {
  const response = await postJson(API_URL, { text }, { clientId, timeoutMs });
  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );
  if (status === 200) {
    return { status, message, data };
  }
  return { status, message, data: null };
};
