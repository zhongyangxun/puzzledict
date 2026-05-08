const API_URL = 'http://127.0.0.1:8789/lookup';

export async function queryDictionary(text) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lookup_key: text }),
  });
  console.log('response', response);

  if (response.status !== 200) {
    return null;
  }

  return response.json();
}
