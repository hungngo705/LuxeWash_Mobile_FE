/**
 * Branch API Service
 * Handles branch/endpoints for the customer booking flow
 *
 * Nhóm API chi nhánh: lấy danh sách chi nhánh phục vụ luồng đặt lịch của khách.
 */

import { apiClient, ApiResponse } from './client';

/** Thông tin một chi nhánh rửa xe */
export interface BranchDTO {
  branchId: number;
  name: string;
  address: string;
  isActive: boolean; // Chi nhánh có đang hoạt động không
  latitude?: number; // Vĩ độ (dùng để tính khoảng cách)
  longitude?: number; // Kinh độ
}

export const branchService = {
  /** Lấy danh sách tất cả chi nhánh */
  getBranches: async (): Promise<ApiResponse<BranchDTO[]>> => {
    return apiClient.get<BranchDTO[]>('/branches');
  },
};
