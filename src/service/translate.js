import { parseJsonResponse, postJson } from '../background/api-client';
import {
  TRANSLATE_FAILED_MESSAGE,
  TRANSLATE_SUCCESS_MESSAGE,
} from '../lib/translate-messages.js';

const API_URL = 'http://127.0.0.1:8787/translate';

const getMessage = (status) => {
  switch (status) {
    case 200:
      return TRANSLATE_SUCCESS_MESSAGE;
    default:
      return TRANSLATE_FAILED_MESSAGE;
  }
};

export const translateSentence = async (text, clientId) => {
  const response = await postJson(API_URL, { text }, { clientId });
  const { status, data, message } = await parseJsonResponse(
    response,
    getMessage,
  );
  if (status === 200) {
    return { status, message, data };
  }
  return { status, message, data: null };
};
