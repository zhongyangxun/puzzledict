import { DICT_LOOKUP_URL } from '../../lib/api.js';
import {
  DICT_FAILED_MESSAGE,
  DICT_SUCCESS_MESSAGE,
  NOT_FOUND_MESSAGE,
  RATE_LIMIT_MESSAGE,
} from '../../lib/result-messages.js';
import {
  parseJsonResponse,
  postJson,
  REQUEST_TIMEOUT_MS,
} from '../api-client.js';

export async function queryDictionary(
  text,
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS },
) {
  const response = await postJson(
    DICT_LOOKUP_URL,
    { lookup_key: text },
    { clientId, timeoutMs },
  );

  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );

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
