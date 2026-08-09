/**
 * Vehicle API Service
 * Handles vehicle management endpoints
 *
 * Nhóm API quản lý xe: loại xe, mẫu xe, danh sách xe của người dùng,
 * thêm/xoá xe (kèm upload ảnh đăng ký).
 */

import { apiClient, ApiResponse } from './client';

/** Loại phương tiện (vd sedan, SUV) */
export interface VehicleType {
  id: number;
  name: string;
}

/** Mẫu xe theo hãng */
export interface CarModel {
  id: number;
  brand: string; // Hãng xe
  name: string; // Tên mẫu xe
  vehicleTypeId?: number | null; // Loại xe tương ứng (nếu có)
}

/** Thông tin xe của người dùng trả về từ backend */
export interface VehicleResponse {
  licensePlate: string; // Biển số xe (khoá định danh)
  vehicleTypeId: number;
  vehicleType: string;
  registrationPhotoUrl: string | null; // Ảnh đăng ký xe
  carModel: string | null;
  brand: string | null;
  userNote: string | null; // Ghi chú riêng của người dùng về xe
}

/** Dữ liệu đề xuất thêm mẫu xe mới (khi chưa có trong danh sách) */
export interface RequestCarModelPayload {
  brand: string;
  name: string;
  year?: number | null;
  version?: string | null;
  vehicleTypeId?: number | null;
}

export interface UpdateVehiclePayload {
  vehicleTypeId: number;
  carModelId?: number;
  carModel?: string;
  photoFile?: Blob;
  userNote?: string;
}

export const vehicleService = {
  /** Lấy danh sách các loại phương tiện */
  getVehicleTypes: async (): Promise<ApiResponse<VehicleType[]>> => {
    return apiClient.get<VehicleType[]>('/admin/vehicle-types');
  },

  /** Lấy danh sách mẫu xe */
  getCarModels: async (): Promise<ApiResponse<CarModel[]>> => {
    return apiClient.get<CarModel[]>('/carModels');
  },

  /**
   * Request a new car model (crowdsourcing).
   * POST /api/v1/carmodels/request
   * Returns the new CarModelId.
   *
   * Đề xuất thêm một mẫu xe mới do người dùng đóng góp. Trả về CarModelId vừa tạo.
   */
  requestCarModel: async (
    payload: RequestCarModelPayload,
  ): Promise<ApiResponse<number>> => {
    return apiClient.post<number>('/carModels/request', payload);
  },

  /** Lấy danh sách xe của người dùng đang đăng nhập */
  getMyVehicles: async (): Promise<ApiResponse<VehicleResponse[]>> => {
    return apiClient.get<VehicleResponse[]>('/vehicles');
  },

  /**
   * Add a vehicle. Pass photoFile (Blob/File) for direct Cloudinary upload,
   * or registrationPhotoUrl (string) for a pre-uploaded image URL.
   * PhotoFile takes priority when both are provided.
   *
   * Thêm một xe mới. Truyền photoFile (Blob/File) để upload ảnh trực tiếp,
   * hoặc registrationPhotoUrl (URL ảnh đã upload sẵn). Nếu có cả hai thì
   * photoFile được ưu tiên. Dữ liệu gửi dạng multipart/form-data.
   */
  addVehicle: async (data: {
    licensePlate: string;
    vehicleTypeId?: number | null;
    carModel?: string;
    carModelId?: number;
    registrationPhotoUrl?: string;
    photoFile?: Blob;
    userNote?: string;
  }): Promise<ApiResponse<void>> => {
    // Xây dựng form-data: chỉ đính kèm các field có giá trị hợp lệ
    const formData = new FormData();
    formData.append('licensePlate', data.licensePlate);
    if (data.vehicleTypeId != null && data.vehicleTypeId > 0) {
      formData.append('vehicleTypeId', String(data.vehicleTypeId));
    }
    if (data.carModelId != null) {
      formData.append('carModelId', String(data.carModelId));
    } else if (data.carModel) {
      formData.append('carModel', data.carModel);
    }
    if (data.photoFile) {
      formData.append('PhotoFile', data.photoFile);
    }
    if (data.registrationPhotoUrl) {
      formData.append('registrationPhotoUrl', data.registrationPhotoUrl);
    }
    if (data.userNote) {
      formData.append('userNote', data.userNote);
    }
    return apiClient.postForm<void>('/vehicles', formData);
  },

  /** Cập nhật thông tin xe; biển số chỉ dùng để định danh và không thể thay đổi. */
  updateVehicle: async (
    licensePlate: string,
    data: UpdateVehiclePayload,
  ): Promise<ApiResponse<void>> => {
    const formData = new FormData();
    formData.append('vehicleTypeId', String(data.vehicleTypeId));
    if (data.carModelId != null) {
      formData.append('carModelId', String(data.carModelId));
    } else if (data.carModel?.trim()) {
      formData.append('carModel', data.carModel.trim());
    }
    if (data.photoFile) {
      formData.append('PhotoFile', data.photoFile);
    }
    if (data.userNote?.trim()) {
      formData.append('userNote', data.userNote.trim());
    }

    return apiClient.putForm<void>(
      `/vehicles/${encodeURIComponent(licensePlate)}`,
      formData,
    );
  },

  /** Xoá xe theo biển số */
  deleteVehicle: async (licensePlate: string): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/vehicles/${encodeURIComponent(licensePlate)}`);
  },
};
