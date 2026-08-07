/**
 * LuxeWash Authentication Context
 * Handles user login/logout state with real API integration
 *
 * Context xác thực: quản lý trạng thái người dùng (đăng nhập/đăng xuất),
 * số dư ví, danh sách xe, và cung cấp các hàm login/register/logout/đổi mật khẩu...
 * cho toàn bộ ứng dụng qua hook useAuth().
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { authService, type UserProfile } from "../services/api/authService";
import {
  ApiError,
  getStoredTokens,
  setSessionExpiredHandler,
} from "../services/api/client";
import { vehicleService, type VehicleResponse } from "../services/api/vehicleService";
import { walletService } from "../services/api/walletService";
import { unregisterCurrentDevicePushToken } from "../services/pushNotificationService";

/** Mô hình xe hiển thị trong app (đã chuẩn hoá từ dữ liệu API) */
export interface Vehicle {
  id: string;
  licensePlate: string;
  brand: string;
  model: string;
  color: string;
  vehicleTypeId?: number;
  vehicleType?: string;
  userNote?: string;
  imageUrl?: string;
  userId: string;
  createdAt: Date;
}

/** Người dùng đã đăng nhập (gộp thông tin hồ sơ + hạng thành viên + xe) */
export interface AuthUser {
  id: string;
  phoneNumber: string;
  email?: string;
  name: string;
  membershipId: string;
  membershipTier: "standard" | "silver" | "gold" | "platinum" | "diamond"; // Hạng thành viên
  loyaltyPoints: number; // Điểm tích luỹ
  createdAt: Date;
  updatedAt: Date;
  vehicles: Vehicle[];
  status?: string;
  dateOfBirth?: string | null;
  promotionPoint?: number; // Điểm khuyến mãi
  churnScore?: number; // Điểm dự đoán rời bỏ (dùng cho ưu đãi giữ chân)
}

/** Thông tin đăng nhập: số điện thoại hoặc email + mật khẩu */
interface LoginCredentials {
  phoneOrEmail: string;
  password: string;
}

/** Trạng thái nội bộ của context xác thực */
interface AuthState {
  user: AuthUser | null;
  walletBalance: number; // Số dư ví
  isLoading: boolean; // Đang khôi phục phiên khi mở app
  isLoggingIn: boolean; // Đang xử lý đăng nhập
  isRegistering: boolean; // Đang xử lý đăng ký
  isAuthenticated: boolean;
}

/** Giá trị context cung cấp ra ngoài: trạng thái + các hành động */
interface AuthContextType extends AuthState {
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string; unverifiedEmail?: string }>;
  register: (
    phoneNumber: string,
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  addVehicle: (
    licensePlate: string,
    vehicleTypeId: number,
    photoFile?: Blob,
    userNote?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeVehicle: (
    licensePlate: string,
  ) => Promise<{ success: boolean; error?: string }>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
  loginFromOtp: (
    userId: string,
    phoneNumber: string,
    fullName: string,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Nguồn dữ liệu xe có thể đến từ API xe hoặc từ hồ sơ người dùng
type VehicleSource = VehicleResponse | UserProfile["vehicles"][number];

// Chuẩn hoá dữ liệu xe từ API về mô hình Vehicle dùng trong app
function mapVehicleApiToVehicle(v: VehicleSource, userId: string): Vehicle {
  return {
    id: v.licensePlate,
    licensePlate: v.licensePlate,
    brand: "brand" in v ? v.brand || "" : "",
    model: v.carModel || "",
    color: "",
    vehicleTypeId: v.vehicleTypeId,
    vehicleType: v.vehicleType || "",
    userNote: "userNote" in v ? v.userNote || "" : "",
    imageUrl: v.registrationPhotoUrl ?? undefined,
    userId,
    createdAt: new Date(),
  };
}

/** Provider bọc toàn app, cung cấp trạng thái và hành động xác thực */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    walletBalance: 0,
    isLoading: true,
    isLoggingIn: false,
    isRegistering: false,
    isAuthenticated: false,
  });

  // Tham chiếu tới hàm logout để handler hết phiên gọi được (tránh phụ thuộc vòng)
  const logoutRef = useRef<(() => Promise<void>) | null>(null);

  // Khi token hết hạn không refresh được, tự động đăng xuất
  useEffect(() => {
    const handleSessionExpired = () => {
      logoutRef.current?.();
    };
    setSessionExpiredHandler(handleSessionExpired);
    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  // Khi mở app: nếu có token đã lưu thì khôi phục phiên đăng nhập
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { accessToken, refreshToken } = await getStoredTokens();
        if (!accessToken || !refreshToken) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const profileRes = await authService.getProfile();
        if (profileRes.statusCode === 200 && profileRes.data) {
          const walletRes = await walletService.getBalance();
          const walletBalance =
            walletRes.statusCode === 200 && walletRes.data
              ? walletRes.data.balance
              : 0;
          const profile = profileRes.data;
          const userId = String(profile.userId);

          const vehicleTypesRes = await vehicleService.getVehicleTypes();
          const vehiclesRes = await vehicleService.getMyVehicles();
          const vehicleTypeMap: Record<string, number> = {};
          if (vehicleTypesRes.statusCode === 200 && vehicleTypesRes.data) {
            for (const vt of vehicleTypesRes.data) {
              vehicleTypeMap[vt.name.toLowerCase()] = vt.id;
            }
          }

          const vehicles = (
            vehiclesRes.statusCode === 200 && vehiclesRes.data
              ? vehiclesRes.data
              : (profile?.vehicles ?? [])
          ).map((v) => {
            const vehicle = mapVehicleApiToVehicle(v, userId);
            vehicle.vehicleTypeId =
              vehicleTypeMap[v.vehicleType?.toLowerCase() ?? ""] ??
              v.vehicleTypeId;
            return vehicle;
          });

          const authUser: AuthUser = {
            id: userId,
            phoneNumber: profile.phoneNumber,
            name: profile.fullName,
            email: profile.email ?? undefined,
            membershipId: profile.tierName?.toLowerCase() || "standard",
            membershipTier: (profile.tierName?.toLowerCase() ||
              "standard") as any,
            loyaltyPoints: profile.totalPoint ?? 0,
            promotionPoint: profile.promotionPoint ?? 0,
            churnScore: profile.churnScore ?? 0,
            status: profile.status ?? "Active",
            dateOfBirth: profile.dateOfBirth ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            vehicles,
          };

          setState({
            user: authUser,
            walletBalance,
            isLoading: false,
            isLoggingIn: false,
            isRegistering: false,
            isAuthenticated: true,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    restoreSession();
  }, []);

  // Lấy song song hồ sơ + số dư ví + danh sách xe (dùng lại ở nhiều nơi)
  const fetchProfileAndWallet = async (userId: string) => {
    const [profileRes, walletRes, vehiclesRes] = await Promise.all([
      authService.getProfile(),
      walletService.getBalance(),
      vehicleService.getMyVehicles(),
    ]);

    const profile =
      profileRes.statusCode === 200 && profileRes.data ? profileRes.data : null;
    const wallet =
      walletRes.statusCode === 200 && walletRes.data ? walletRes.data : null;

    return {
      profile,
      walletBalance: wallet?.balance ?? 0,
      vehicles:
        vehiclesRes.statusCode === 200 && vehiclesRes.data
          ? vehiclesRes.data.map((v) => mapVehicleApiToVehicle(v, userId))
          : [],
    };
  };

  /**
   * Đăng nhập bằng SĐT/email + mật khẩu.
   * Trả về unverifiedEmail nếu tài khoản chưa xác thực email (để điều hướng OTP).
   */
  const login = async (
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string; unverifiedEmail?: string }> => {
    setState((prev) => ({ ...prev, isLoggingIn: true }));

    try {
      const response = await authService.login({
        phoneOrEmail: credentials.phoneOrEmail,
        password: credentials.password,
      });

      // 401 kèm thông điệp "xác thực" => tài khoản chưa xác thực email
      if (response.statusCode === 401 &&
          response.message?.toLowerCase().includes("xác thực")) {
        const email = credentials.phoneOrEmail.includes("@")
          ? credentials.phoneOrEmail
          : "";
        setState((prev) => ({ ...prev, isLoggingIn: false }));
        return {
          success: false,
          error: response.message || "Tài khoản chưa xác thực email",
          unverifiedEmail: email,
        };
      }

      if (response.statusCode !== 200) {
        return {
          success: false,
          error: response.message || "Đăng nhập thất bại",
        };
      }

      const loginData = response.data;

      const { walletBalance, vehicles, profile } = await fetchProfileAndWallet(
        String(loginData.userId),
      );

      const authUser: AuthUser = {
        id: String(loginData.userId),
        phoneNumber: loginData.phoneNumber,
        name: loginData.fullName,
        membershipId: profile?.tierName?.toLowerCase() || "standard",
        membershipTier: (profile?.tierName?.toLowerCase() || "standard") as any,
        loyaltyPoints: profile?.totalPoint ?? 0,
        promotionPoint: profile?.promotionPoint ?? 0,
        churnScore: profile?.churnScore ?? 0,
        status: profile?.status ?? "Active",
        dateOfBirth: profile?.dateOfBirth ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicles,
      };

      setState({
        user: authUser,
        walletBalance,
        isLoading: false,
        isLoggingIn: false,
        isRegistering: false,
        isAuthenticated: true,
      });
      return { success: true };
    } catch (error) {
      const isUnverified =
        error instanceof ApiError &&
        error.statusCode === 401 &&
        error.message?.toLowerCase().includes("xác thực");
      const message =
        error instanceof ApiError
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại";
      setState((prev) => ({ ...prev, isLoggingIn: false }));
      return {
        success: false,
        error: message,
        unverifiedEmail: isUnverified ? (credentials.phoneOrEmail.includes("@") ? credentials.phoneOrEmail : "") : undefined,
      };
    }
  };

  // Tải lại hồ sơ + ví + xe và cập nhật vào state (giữ nguyên các trường không đổi)
  const refreshProfile = async () => {
    if (!state.user) return;
    const { profile, walletBalance, vehicles } = await fetchProfileAndWallet(
      state.user.id,
    );
    setState((prev) => ({
      ...prev,
      user: prev.user
        ? {
            ...prev.user,
            name: profile?.fullName ?? prev.user.name,
            phoneNumber: profile?.phoneNumber ?? prev.user.phoneNumber,
            email: profile?.email ?? prev.user.email,
            membershipId:
              profile?.tierName?.toLowerCase() || prev.user.membershipId,
            membershipTier: (profile?.tierName?.toLowerCase() ||
              prev.user.membershipTier) as any,
            loyaltyPoints: profile?.totalPoint ?? prev.user.loyaltyPoints,
            promotionPoint: profile?.promotionPoint ?? prev.user.promotionPoint,
            churnScore: profile?.churnScore ?? prev.user.churnScore,
            status: profile?.status ?? prev.user.status,
            dateOfBirth: profile?.dateOfBirth ?? prev.user.dateOfBirth,
            vehicles,
          }
        : null,
      walletBalance,
    }));
  };

  // Đăng ký tài khoản mới (thành công khi statusCode 201; sau đó thường cần xác thực OTP)
  const register = async (
    phoneNumber: string,
    email: string,
    password: string,
    fullName: string,
  ): Promise<{ success: boolean; error?: string }> => {
    setState((prev) => ({ ...prev, isRegistering: true }));

    try {
      const response = await authService.register({
        phoneNumber,
        email,
        password,
        fullName,
      });

      if (response.statusCode !== 201) {
        return {
          success: false,
          error: response.message || "Đăng ký thất bại",
        };
      }

      setState((prev) => ({ ...prev, isRegistering: false }));
      return { success: true };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại";
      setState((prev) => ({ ...prev, isRegistering: false }));
      return { success: false, error: message };
    }
  };

  // Chỉ tải lại số dư ví (dùng sau khi nạp tiền/thanh toán)
  const refreshWallet = async () => {
    try {
      const walletRes = await walletService.getBalance();
      if (walletRes.statusCode === 200 && walletRes.data) {
        setState((prev) => ({
          ...prev,
          walletBalance: walletRes.data!.balance,
        }));
      }
    } catch {
      // silently fail
    }
  };

  // Đăng nhập ngay sau khi xác thực OTP thành công (không cần nhập lại mật khẩu)
  const loginFromOtp = async (
    userId: string,
    phoneNumber: string,
    fullName: string,
  ): Promise<void> => {
    const { profile, walletBalance, vehicles } = await fetchProfileAndWallet(userId);
    const authUser: AuthUser = {
      id: userId,
      phoneNumber: profile?.phoneNumber ?? phoneNumber,
      name: profile?.fullName ?? fullName,
      email: profile?.email ?? undefined,
      membershipId: profile?.tierName?.toLowerCase() || "standard",
      membershipTier: (profile?.tierName?.toLowerCase() || "standard") as any,
      loyaltyPoints: profile?.totalPoint ?? 0,
      promotionPoint: profile?.promotionPoint ?? 0,
      churnScore: profile?.churnScore ?? 0,
      status: profile?.status ?? "Active",
      dateOfBirth: profile?.dateOfBirth ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      vehicles,
    };
    setState({
      user: authUser,
      walletBalance,
      isLoading: false,
      isLoggingIn: false,
      isRegistering: false,
      isAuthenticated: true,
    });
  };

  // Đăng xuất: gỡ token đẩy, gọi API logout và xoá state cục bộ
  const logout = useCallback(async () => {
    try {
      await unregisterCurrentDevicePushToken();
    } catch {
      // Logout must still clear the local session if token cleanup fails.
    }
    await authService.logout();
    setState({
      user: null,
      walletBalance: 0,
      isLoading: false,
      isLoggingIn: false,
      isRegistering: false,
      isAuthenticated: false,
    });
  }, []);

  logoutRef.current = logout; // Cập nhật ref để handler hết phiên dùng bản logout mới nhất

  // Thêm xe mới (kèm ảnh đăng ký nếu có) rồi tải lại hồ sơ
  const addVehicle = async (
    licensePlate: string,
    vehicleTypeId: number,
    photoFile?: Blob,
    userNote?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!state.user) return { success: false, error: "Chưa đăng nhập" };

    try {
      const response = await vehicleService.addVehicle({
        licensePlate,
        vehicleTypeId,
        carModel: "",
        photoFile,
        userNote,
      });
      if (response.statusCode === 200 || response.statusCode === 201) {
        await refreshProfile();
        return { success: true };
      }
      return { success: false, error: response.message || "Thêm xe thất bại" };
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Đã xảy ra lỗi";
      return { success: false, error: message };
    }
  };

  // Xoá xe theo biển số rồi tải lại hồ sơ
  const removeVehicle = async (
    licensePlate: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!state.user) return { success: false, error: "Chưa đăng nhập" };

    try {
      const response = await vehicleService.deleteVehicle(licensePlate);
      if (response.statusCode === 200 || response.statusCode === 204) {
        await refreshProfile();
        return { success: true };
      }
      return { success: false, error: response.message || "Xóa xe thất bại" };
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Đã xảy ra lỗi";
      return { success: false, error: message };
    }
  };

  // Đổi mật khẩu (mật khẩu cũ -> mật khẩu mới)
  const changePassword = async (
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authService.changePassword({
        oldPassword,
        newPassword,
      });
      if (response.statusCode === 200) {
        return { success: true };
      }
      return {
        success: false,
        error: response.message || "Đổi mật khẩu thất bại",
      };
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Đã xảy ra lỗi";
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshProfile,
        refreshWallet,
        addVehicle,
        removeVehicle,
        changePassword,
        loginFromOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook truy cập context xác thực; phải dùng bên trong <AuthProvider> */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
