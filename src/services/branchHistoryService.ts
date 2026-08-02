/**
 * Branch History Service
 * Persists recently used branches via AsyncStorage, so the "Đã đặt" tab
 * can show up to 3 unique branches the user has booked at most recently.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { BranchDTO } from '@/services/api/branchService';

const isWeb = Platform.OS === 'web'; // Nền web dùng localStorage thay cho AsyncStorage

const HISTORY_KEY = '@luxewash_recent_branches'; // Khoá lưu trong storage
const MAX_RECENT = 3; // Số chi nhánh gần đây tối đa được giữ lại

/** Chi nhánh gần đây = thông tin chi nhánh kèm thời điểm sử dụng */
export interface RecentBranch extends BranchDTO {
  usedAt: string; // ISO timestamp
}

// Adapter storage cho web (bọc localStorage để không ném lỗi khi bị chặn)
const webStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
};

/** Load all stored recent branches, most-recent first. */
export async function getRecentBranches(): Promise<RecentBranch[]> {
  try {
    const raw = isWeb
      ? await webStorage.getItem(HISTORY_KEY)
      : await AsyncStorage.getItem(HISTORY_KEY);

    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentBranch[];
    if (!Array.isArray(parsed)) return [];
    // Sort by most recent first, limit to MAX_RECENT
    return parsed
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * Record that the user booked at the given branch.
 * If the branch was already in history, its timestamp is refreshed.
 * Otherwise it is prepended. History is capped at MAX_RECENT entries.
 */
export async function addRecentBranch(branch: BranchDTO): Promise<void> {
  if (!branch || !branch.branchId) return;

  const existing = await getRecentBranches();

  // Remove duplicate branchId if present
  const filtered = existing.filter(b => b.branchId !== branch.branchId);

  const updated: RecentBranch[] = [
    { ...branch, usedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_RECENT);

  try {
    const raw = JSON.stringify(updated);
    if (isWeb) {
      await webStorage.setItem(HISTORY_KEY, raw);
    } else {
      await AsyncStorage.setItem(HISTORY_KEY, raw);
    }
  } catch {
    // Storage write failure — non-critical
  }
}

/** Clear all branch history. */
export async function clearRecentBranches(): Promise<void> {
  try {
    if (isWeb) {
      localStorage.removeItem(HISTORY_KEY);
    } else {
      await AsyncStorage.removeItem(HISTORY_KEY);
    }
  } catch {
    // ignore
  }
}

// Đối tượng gom các hàm thao tác lịch sử chi nhánh để import tiện lợi
export const branchHistoryService = {
  getRecentBranches,
  addRecentBranch,
};
