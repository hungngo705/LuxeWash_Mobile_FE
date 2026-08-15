/**
 * LuxeWash Authentication Context
 * Handles user login/logout state with real API integration
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
import { ApiError, getStoredTokens, setSessionExpiredHandler } from "../services/api/client";
import { vehicleService, type VehicleResponse } from "../services/api/vehicleService";
import { walletService } from "../services/api/walletService";

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

export interface AuthUser {
  id: string;
  phoneNumber: string;
  email?: string;
  name: string;
  role: "customer" | "staff" | "admin";
  membershipId: string;
  membershipTier: "standard" | "silver" | "gold" | "platinum" | "diamond";
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
  vehicles: Vehicle[];
  status?: string;
  dateOfBirth?: string | null;
  promotionPoint?: number;
  churnScore?: number;
}

interface LoginCredentials {
  phoneOrEmail: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  walletBalance: number;
  isLoading: boolean;
  isLoggingIn: boolean;
  isRegistering: boolean;
  isAuthenticated: boolean;
}

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
    role: string,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type VehicleSource = VehicleResponse | UserProfile["vehicles"][number];

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    walletBalance: 0,
    isLoading: true,
    isLoggingIn: false,
    isRegistering: false,
    isAuthenticated: false,
  });

  const logoutRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      logoutRef.current?.();
    };
    setSessionExpiredHandler(handleSessionExpired);
    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

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
            role: "customer" as const,
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

  const login = async (
    credentials: LoginCredentials,
  ): Promise<{ success: boolean; error?: string; unverifiedEmail?: string }> => {
    setState((prev) => ({ ...prev, isLoggingIn: true }));

    try {
      const response = await authService.login({
        phoneOrEmail: credentials.phoneOrEmail,
        password: credentials.password,
      });

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
        role: (loginData.role?.toLowerCase() || "customer") as
          | "customer"
          | "staff"
          | "admin",
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

  const loginFromOtp = async (
    userId: string,
    phoneNumber: string,
    fullName: string,
    role: string,
  ): Promise<void> => {
    const { profile, walletBalance, vehicles } = await fetchProfileAndWallet(userId);
    const authUser: AuthUser = {
      id: userId,
      phoneNumber: profile?.phoneNumber ?? phoneNumber,
      name: profile?.fullName ?? fullName,
      email: profile?.email ?? undefined,
      role: (role?.toLowerCase() || "customer") as
        | "customer"
        | "staff"
        | "admin",
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

  const logout = useCallback(async () => {
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

  logoutRef.current = logout;

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
