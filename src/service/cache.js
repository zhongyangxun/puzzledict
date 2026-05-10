const CACHE_KEY = 'dict-api-cache';
const MAX_ENTRIES = 500;
const DELETE_COUNT = 100; // 写入时，数据超过 MAX_ENTRIES 时，删除最早的 DELETE_COUNT 条数据
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天
const EXPIRE_TIME_KEY = '__EXPIRE_TIME__';

export async function getCache(lookupKey) {
  const { [CACHE_KEY]: cache } = await chrome.storage.local.get({
    [CACHE_KEY]: {},
  });

  const res = { ...cache[lookupKey] };
  const expireTime = res?.[EXPIRE_TIME_KEY] || 0;

  if (expireTime < Date.now()) return null;

  delete res[EXPIRE_TIME_KEY];

  return res;
}

export async function setCache(lookupKey, value) {
  const { [CACHE_KEY]: cache } = await chrome.storage.local.get({
    [CACHE_KEY]: {},
  });

  cache[lookupKey] = { ...value, [EXPIRE_TIME_KEY]: Date.now() + TTL_MS };

  if (Object.keys(cache).length > MAX_ENTRIES) {
    const sortedKeys = Object.keys(cache).sort(
      (a, b) =>
        (cache[a][EXPIRE_TIME_KEY] ?? 0) - (cache[b][EXPIRE_TIME_KEY] ?? 0),
    );
    // 删除最早的 DELETE_COUNT 条数据
    for (let i = 0; i < DELETE_COUNT; i++) {
      delete cache[sortedKeys[i]];
    }
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}
