export const REQUEST_TIMEOUT_MS = 3000;

export const postJson = async (
  url,
  body,
  { clientId, timeoutMs = REQUEST_TIMEOUT_MS },
) => {
  let response = null;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });

    return response;
  } catch (error) {
    console.error('请求超时', error);
    return {
      status: 504,
      message: '请求超时，请稍后再试',
      data: null,
    };
  }
};

export async function parseJsonResponse(response, getMessage) {
  const { status } = response;
  if (status !== 200) {
    return {
      status,
      message: getMessage(status),
      data: null,
    };
  }
  const data = await response.json();
  return {
    status,
    message: getMessage(status),
    data,
  };
}
