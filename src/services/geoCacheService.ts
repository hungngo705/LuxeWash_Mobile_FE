/**
 * Persistent geocode cache using AsyncStorage.
 * Caches geocoded addresses to avoid re-hitting Nominatim on every app open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CACHE_KEY = '@luxewash_geo_cache'; // Khoá lưu cache toạ độ

/** Một bản ghi cache: toạ độ đã geocode kèm thời điểm lưu */
interface CachedEntry {
  latitude: number;
  longitude: number;
  cachedAt: number;
}

/** Cấu trúc cache: ánh xạ địa chỉ (đã chuẩn hoá) -> toạ độ */
interface GeoCache {
  [normalizedAddress: string]: CachedEntry;
}

const isWeb = Platform.OS === 'web'; // Web dùng localStorage

const webCache: GeoCache = {}; // Bản sao trong bộ nhớ cho nền web

async function webGet<T>(key: string): Promise<T | null> {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function webSet(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

async function webDel(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Đọc toàn bộ cache từ storage (web hoặc AsyncStorage), trả về {} nếu lỗi
async function getCache(): Promise<GeoCache> {
  if (isWeb) {
    const val = await webGet<GeoCache>(CACHE_KEY);
    return val ?? {};
  }
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GeoCache) : {};
  } catch {
    return {};
  }
}

// Ghi toàn bộ cache xuống storage
async function saveCache(cache: GeoCache): Promise<void> {
  if (isWeb) {
    Object.assign(webCache, cache);
    await webSet(CACHE_KEY, cache);
  } else {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }
}

// Chuẩn hoá địa chỉ làm khoá cache: bỏ khoảng trắng thừa, chữ thường
function normalize(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Look up a cached coordinate for an address. Returns null if not cached. */
export async function getCached(address: string | null | undefined): Promise<{ latitude: number; longitude: number } | null> {
  if (!address) return null;
  const cache = await getCache();
  return cache?.[normalize(address)] ?? null;
}

/** Store a geocoded result for an address. */
export async function setCached(
  address: string | null | undefined,
  coords: { latitude: number; longitude: number },
): Promise<void> {
  if (!address) return;
  const cache = await getCache();
  if (!cache) return;
  cache[normalize(address)] = { ...coords, cachedAt: Date.now() };
  await saveCache(cache);
}

/** Clear the entire geocode cache. */
export async function clearCache(): Promise<void> {
  if (isWeb) {
    await webDel(CACHE_KEY);
  } else {
    await AsyncStorage.removeItem(CACHE_KEY);
  }
}
