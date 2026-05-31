import { createStorageCache } from '../storage-cache';

const CACHE_KEY = 'dict-api-cache';
const MAX_ENTRIES = 500;
const DELETE_COUNT = 100; // 写入时，数据超过 MAX_ENTRIES 时，删除最早的 DELETE_COUNT 条数据
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天
const EXPIRE_TIME_KEY = '__EXPIRE_TIME__';

export const { get: getDictCache, set: setDictCache } = createStorageCache({
  cacheKey: CACHE_KEY,
  maxEntries: MAX_ENTRIES,
  deleteCount: DELETE_COUNT,
  ttlMs: TTL_MS,
  expireTimeKey: EXPIRE_TIME_KEY,
});
