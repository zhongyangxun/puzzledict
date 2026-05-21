import { parseJsonResponse, postJson } from '../background/api-client';

const API_URL = 'http://127.0.0.1:8787/translate';

const getMessage = (status) => {
  switch (status) {
    case 200:
      return '翻译成功';
    default:
      return '翻译失败';
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
