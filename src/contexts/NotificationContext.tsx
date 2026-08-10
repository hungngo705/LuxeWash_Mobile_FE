import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import {
  BASE_URL,
  getStoredTokens,
  notificationService,
  type UserNotification,
} from "@/services/api";

interface NotificationContextValue {
  notifications: UserNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const HUB_URL = `${BASE_URL.replace(/\/api\/v1\/?$/, "")}/hubs/notification`;

/** Chấp nhận cả JSON camelCase và PascalCase để không phụ thuộc serializer SignalR. */
function normalizeNotification(raw: unknown): UserNotification | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = Number(item.id ?? item.Id);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    title: String(item.title ?? item.Title ?? "Thông báo"),
    body: String(item.body ?? item.Body ?? ""),
    type: String(item.type ?? item.Type ?? "General"),
    referenceId:
      item.referenceId === null || item.ReferenceId === null
        ? null
        : String(item.referenceId ?? item.ReferenceId ?? "") || null,
    isRead: Boolean(item.isRead ?? item.IsRead),
    createdAt: String(item.createdAt ?? item.CreatedAt ?? new Date().toISOString()),
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const [listResponse, countResponse] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(listResponse.data) ? listResponse.data : []);
      setUnreadCount(
        typeof countResponse.data === "number" ? Math.max(0, countResponse.data) : 0,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải thông báo.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (notificationId: number) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.isRead) return;

    await notificationService.markAsRead(notificationId);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount <= 0) return;
    await notificationService.markAllAsRead();
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  }, [unreadCount]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      return;
    }
    void refreshNotifications();
  }, [isAuthLoading, isAuthenticated, refreshNotifications, user?.id]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let connection: HubConnection | undefined;

    const startConnection = async () => {
      if (disposed) return;
      if (!connection) {
        connection = new HubConnectionBuilder()
          .withUrl(HUB_URL, {
            accessTokenFactory: async () => {
              const { accessToken } = await getStoredTokens();
              return accessToken ?? "";
            },
          })
          .withAutomaticReconnect([0, 2000, 10000, 30000])
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on("ReceiveNotification", (raw: unknown) => {
          const incoming = normalizeNotification(raw);
          if (!incoming) return;

          setNotifications((current) => {
            if (current.some((item) => item.id === incoming.id)) return current;
            if (!incoming.isRead) {
              setUnreadCount((count) => count + 1);
            }
            return [incoming, ...current];
          });
        });
        connection.onreconnected(() => {
          void refreshNotifications();
        });
        connection.onclose(() => {
          if (!disposed) retryTimer = setTimeout(() => void startConnection(), 10000);
        });
      }

      if (connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
      } catch {
        if (!disposed) retryTimer = setTimeout(() => void startConnection(), 10000);
      }
    };

    void startConnection();

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshNotifications();
        void startConnection();
      }
    });

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      appStateSubscription.remove();
      if (connection) {
        connection.off("ReceiveNotification");
        void connection.stop();
      }
    };
  }, [isAuthLoading, isAuthenticated, refreshNotifications, user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        error,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
