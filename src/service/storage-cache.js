export const createStorageCache = ({
  cacheKey,
  maxEntries,
  deleteCount,
  ttlMs,
  expireTimeKey = '__EXPIRE_TIME__',
}) => {
  return {
    get: async (key) => {
      const { [cacheKey]: cache } = await chrome.storage.local.get({
        [cacheKey]: {},
      });

      const res = { ...cache[key] };
      const expireTime = res?.[expireTimeKey] || 0;

      if (expireTime < Date.now()) return null;

      delete res[expireTimeKey];

      return res;
    },
    set: async (key, value) => {
      const { [cacheKey]: cache } = await chrome.storage.local.get({
        [cacheKey]: {},
      });

      cache[key] = { ...value, [expireTimeKey]: Date.now() + ttlMs };

      if (Object.keys(cache).length > maxEntries) {
        const sortedKeys = Object.keys(cache).sort(
          (a, b) =>
            (cache[a][expireTimeKey] ?? 0) - (cache[b][expireTimeKey] ?? 0),
        );
        // 删除最早的 DELETE_COUNT 条数据
        for (let i = 0; i < deleteCount; i++) {
          delete cache[sortedKeys[i]];
        }
      }

      await chrome.storage.local.set({ [cacheKey]: cache });
    },
  };
};
