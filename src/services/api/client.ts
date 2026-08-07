/**
 * LuxeWash API Client
 * Handles HTTP requests with fetch, interceptors, and persistent token management
 *
 * Tầng giao tiếp HTTP trung tâm của app: bọc fetch, tự động gắn token,
 * tự refresh token khi hết hạn (401) và lưu token bền vững (AsyncStorage/localStorage).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Địa chỉ gốc của API backend và khoá lưu token trong bộ nhớ cục bộ
const BASE_URL = "https://smartwash-be.onrender.com/api/v1";
// const BASE_URL = 'http://10.0.2.2:5030/api/v1'; // Android emulator -> backend HTTP profile (localhost:5030 on the host)
const ACCESS_TOKEN_KEY = "@luxewash_access_token";
const REFRESH_TOKEN_KEY = "@luxewash_refresh_token";

/** Cấu trúc phản hồi chuẩn từ backend cho mọi request (bọc dữ liệu trong field data) */
export interface ApiResponse<T = unknown> {
  statusCode: number; // Mã trạng thái nghiệp vụ do backend trả (thường trùng HTTP status)
  message: string; // Thông điệp mô tả kết quả
  data: T; // Dữ liệu chính của phản hồi
  details: unknown; // Chi tiết bổ sung (thường dùng cho lỗi validation)
  errorCode?: string | null; // Mã lỗi nghiệp vụ (nếu có)
}

const isWeb = Platform.OS === "web";

// Bộ lưu trữ thay thế cho nền web (dùng localStorage vì AsyncStorage tối ưu cho mobile)
const webStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** Lưu access token và refresh token vào bộ nhớ bền vững (web hoặc mobile) */
export const setTokens = async (token: string, refresh: string) => {
  if (isWeb) {
    webStorage.setItem(ACCESS_TOKEN_KEY, token);
    webStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } else {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
};

/** Xoá toàn bộ token đã lưu (dùng khi đăng xuất hoặc phiên hết hạn) */
export const clearTokens = async () => {
  if (isWeb) {
    webStorage.removeItem(ACCESS_TOKEN_KEY);
    webStorage.removeItem(REFRESH_TOKEN_KEY);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/** Lấy access token và refresh token đang lưu trong bộ nhớ cục bộ */
export const getStoredTokens = async (): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> => {
  if (isWeb) {
    const accessToken = webStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = webStorage.getItem(REFRESH_TOKEN_KEY);
    return { accessToken, refreshToken };
  }
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  return { accessToken, refreshToken };
};

/** Lớp lỗi tuỳ chỉnh cho API, mang theo mã trạng thái, chi tiết và mã lỗi nghiệp vụ */
export class ApiError extends Error {
  statusCode: number;
  details: unknown;
  errorCode: string | null;

  constructor(
    statusCode: number,
    message: string,
    details: unknown = null,
    errorCode: string | null = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = errorCode;
    this.name = "ApiError";
  }
}

// Cờ báo đang trong quá trình refresh token và hàng đợi các request chờ token mới.
// Tránh gọi refresh nhiều lần khi có nhiều request cùng bị 401 một lúc.
let isRefreshing = false;
let refreshQueue: Array<(error: ApiError | null) => void> = [];

// Giải phóng hàng đợi: báo cho tất cả request đang chờ biết refresh đã xong (hoặc lỗi)
const processQueue = (error: ApiError | null) => {
  refreshQueue.forEach((cb) => cb(error));
  refreshQueue = [];
};

// Callback được gọi khi phiên hết hạn hẳn (refresh thất bại) — dùng để điều hướng về màn đăng nhập
let onSessionExpired: (() => void) | null = null;

/** Đăng ký hàm xử lý khi phiên đăng nhập hết hạn */
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

/** Gỡ bỏ hàm xử lý phiên hết hạn */
export const clearSessionExpiredHandler = () => {
  onSessionExpired = null;
};

// Chuyển object tham số thành query string (?a=1&b=2), bỏ qua giá trị null/undefined
const buildQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
};

/**
 * Hàm gửi request JSON cốt lõi. Tự gắn Bearer token, xử lý 401 bằng cách
 * refresh token rồi gọi lại request. Tham số retryRefresh đánh dấu đây đã là
 * lần thử lại sau refresh để tránh lặp vô hạn.
 */
async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body?: unknown,
  retryRefresh = false,
): Promise<ApiResponse<T>> {
  const { accessToken, refreshToken } = await getStoredTokens();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = { method, headers };

  let finalEndpoint = endpoint;
  if (body && method === "GET") {
    finalEndpoint =
      endpoint + buildQueryString(body as Record<string, unknown>);
  } else if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${finalEndpoint}`, config);
  } catch (networkError) {
    throw new ApiError(0, "Network error. Please check your connection.", null);
  }

  // Gặp 401 (token hết hạn): thử refresh token nếu chưa từng thử ở request này
  if (response.status === 401 && !retryRefresh && refreshToken) {
    // Nếu chưa có tiến trình refresh nào đang chạy thì tự mình đứng ra refresh
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
        });

        // Refresh thành công: lưu token mới, giải phóng hàng đợi và gọi lại request gốc
        if (refreshResponse.ok) {
          const text = await refreshResponse.text();
          if (text) {
            const data = JSON.parse(text) as ApiResponse<{
              token: string;
              refreshToken: string;
            }>;
            if (data.statusCode === 200 && data.data?.token) {
              await setTokens(data.data.token, data.data.refreshToken);
              processQueue(null);
              isRefreshing = false;
              return request<T>(method, endpoint, body, true);
            }
          }
        }

        // Refresh thất bại: xoá token, thông báo phiên hết hạn và ném lỗi
        await clearTokens();
        if (onSessionExpired) onSessionExpired();
        const err = new ApiError(
          401,
          "Session expired. Please login again.",
          null,
        );
        processQueue(err);
        isRefreshing = false;
        throw err;
      } catch (error) {
        // Có lỗi trong lúc refresh: cũng coi như phiên hết hạn
        await clearTokens();
        if (onSessionExpired) onSessionExpired();
        const err = new ApiError(
          401,
          "Session expired. Please login again.",
          null,
        );
        processQueue(err);
        isRefreshing = false;
        throw err;
      }
    }

    // Đã có tiến trình refresh khác đang chạy: xếp request này vào hàng đợi chờ token mới
    return new Promise((resolve, reject) => {
      refreshQueue.push((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(request<T>(method, endpoint, body, true));
        }
      });
    });
  }

  // Đọc và parse body phản hồi (có thể rỗng hoặc không phải JSON)
  let data: ApiResponse<T> | null = null;

  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text) as ApiResponse<T>;
    }
  } catch {
    // Non-JSON response
  }

  // HTTP lỗi (ngoài 401 đã xử lý): ném ApiError kèm thông tin từ backend
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || `Request failed with status ${response.status}`,
      data?.details,
      data?.errorCode ?? null,
    );
  }

  // Phản hồi thành công nhưng body rỗng: trả về khung ApiResponse với data null
  if (data === null) {
    return {
      statusCode: response.status,
      message: response.statusText,
      data: null as T,
      details: null,
    };
  }

  return data;
}

/**
 * Biến thể của request() dùng cho upload multipart/form-data (vd tải ảnh lên).
 * Không tự set Content-Type để trình duyệt/RN tự thêm boundary. Cùng cơ chế
 * refresh token 401 như request().
 */
async function requestFormData<T>(
  method: "POST" | "PUT" | "DELETE",
  endpoint: string,
  formData: FormData,
  retryRefresh = false,
): Promise<ApiResponse<T>> {
  const { accessToken, refreshToken } = await getStoredTokens();

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: formData,
    });
  } catch (networkError) {
    throw new ApiError(0, "Network error. Please check your connection.", null);
  }

  if (response.status === 401 && !retryRefresh && refreshToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
        });

        if (refreshResponse.ok) {
          const text = await refreshResponse.text();
          if (text) {
            const data = JSON.parse(text) as ApiResponse<{
              token: string;
              refreshToken: string;
            }>;
            if (data.statusCode === 200 && data.data?.token) {
              await setTokens(data.data.token, data.data.refreshToken);
              processQueue(null);
              isRefreshing = false;
              return requestFormData<T>(method, endpoint, formData, true);
            }
          }
        }

        await clearTokens();
        if (onSessionExpired) onSessionExpired();
        const err = new ApiError(
          401,
          "Session expired. Please login again.",
          null,
        );
        processQueue(err);
        isRefreshing = false;
        throw err;
      } catch (error) {
        await clearTokens();
        if (onSessionExpired) onSessionExpired();
        const err = new ApiError(
          401,
          "Session expired. Please login again.",
          null,
        );
        processQueue(err);
        isRefreshing = false;
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      refreshQueue.push((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(requestFormData<T>(method, endpoint, formData, true));
        }
      });
    });
  }

  let data: ApiResponse<T> | null = null;

  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text) as ApiResponse<T>;
    }
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || `Request failed with status ${response.status}`,
      data?.details,
      data?.errorCode ?? null,
    );
  }

  if (data === null) {
    return {
      statusCode: response.status,
      message: response.statusText,
      data: null as T,
      details: null,
    };
  }

  return data;
}

/**
 * Đối tượng client được các service dùng để gọi API.
 * Cung cấp shortcut cho các phương thức HTTP thông dụng.
 */
export const apiClient = {
  // GET kèm query params (params được nối vào URL)
  get: <T>(endpoint: string, params?: Record<string, unknown>) => {
    const qs = params ? buildQueryString(params) : "";
    return request<T>("GET", endpoint + qs);
  },
  // POST với body JSON
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>("POST", endpoint, body),
  // POST với dữ liệu form-data (upload file)
  postForm: <T>(endpoint: string, formData: FormData) =>
    requestFormData<T>("POST", endpoint, formData),
  // PUT với body JSON
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>("PUT", endpoint, body),
  // DELETE (có thể kèm body JSON)
  delete: <T>(endpoint: string, body?: unknown) =>
    request<T>("DELETE", endpoint, body),
};

export { BASE_URL };
