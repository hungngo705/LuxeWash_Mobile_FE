/**
 * Cross-platform confirm dialog.
 * Uses React state internally so callbacks always fire on both web and mobile,
 * unlike react-native Alert.alert which maps to blocking window.alert() on web.
 */
import React, { useState, useCallback, createContext, useContext, ReactNode } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LuxeColors, LuxeSpacing, LuxeBorderRadius } from "@/constants/luxeTheme";

/** Tùy chọn khi mở hộp thoại xác nhận. */
interface ConfirmDialogOptions {
  title: string; // Tiêu đề hộp thoại
  message: string; // Nội dung thông báo
  confirmText?: string; // Nhãn nút đồng ý (mặc định "OK")
  cancelText?: string; // Nhãn nút hủy (mặc định "Hủy")
  destructive?: boolean; // true -> nút xác nhận tô màu cảnh báo (đỏ)
  showCancel?: boolean; // Có hiện nút hủy hay không
  onConfirm?: () => void | Promise<void>; // Callback khi bấm xác nhận
  onCancel?: () => void; // Callback khi bấm hủy
}

/** Giá trị context: hàm mở hộp thoại xác nhận. */
interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType>({
  confirm: () => {},
});

/** Hook lấy hàm confirm() để mở hộp thoại xác nhận từ bất kỳ component nào. */
export function useConfirmDialog() {
  return useContext(ConfirmDialogContext);
}

/** Trạng thái nội bộ của provider — lưu cấu hình hộp thoại hiện tại. */
interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  showCancel: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Provider bao toàn app, cung cấp hàm confirm() và render một hộp thoại dùng chung.
 * Dùng state React nội bộ nên callback luôn chạy đúng trên cả web lẫn mobile.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  // Cấu hình hộp thoại đang hiển thị
  const [state, setState] = useState<ConfirmDialogState>({
    visible: false,
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Hủy",
    destructive: false,
    showCancel: true,
  });

  // Mở hộp thoại với các tùy chọn truyền vào (điền giá trị mặc định nếu thiếu)
  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setState({
      visible: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? "OK",
      cancelText: options.cancelText ?? "Hủy",
      destructive: options.destructive ?? false,
      showCancel: options.showCancel ?? true,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, []);

  // Đóng hộp thoại rồi chạy callback xác nhận (chờ nếu là async)
  const handleConfirm = useCallback(async () => {
    setState((prev) => ({ ...prev, visible: false }));
    await state.onConfirm?.();
  }, [state.onConfirm]);

  // Đóng hộp thoại rồi chạy callback hủy
  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
    state.onCancel?.();
  }, [state.onCancel]);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        visible={state.visible}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        destructive={state.destructive}
        showCancel={state.showCancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
}

/** Component UI hộp thoại (Modal mờ nền) — chỉ nhận props và render, không giữ logic mở/đóng. */
function ConfirmDialog({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  destructive,
  showCancel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaProvider style={styles.modalProvider}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, !showCancel && styles.dialogSingleBtn]}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={[styles.buttons, !showCancel && styles.buttonsSingle]}>
              {showCancel && (
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, destructive ? styles.destructiveBtn : styles.confirmBtn, !showCancel && styles.confirmBtnFull]}
                onPress={onConfirm}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalProvider: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: LuxeSpacing.lg,
  },
  dialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: LuxeBorderRadius.xl,
    padding: LuxeSpacing.xl,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: LuxeColors.onSurface,
    marginBottom: LuxeSpacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: LuxeColors.onSurfaceVariant,
    marginBottom: LuxeSpacing.xl,
    textAlign: "center",
    lineHeight: 20,
  },
  buttons: {
    flexDirection: "row",
    gap: LuxeSpacing.md,
  },
  buttonsSingle: {
    justifyContent: "center",
  },
  dialogSingleBtn: {
    alignItems: "center",
  },
  btn: {
    flex: 1,
    paddingVertical: LuxeSpacing.md,
    borderRadius: LuxeBorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: LuxeColors.surfaceContainerLow + "80",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.onSurfaceVariant,
  },
  confirmBtn: {
    backgroundColor: LuxeColors.primaryContainer,
  },
  confirmBtnFull: {
    minWidth: 120,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: LuxeColors.primary,
  },
  destructiveBtn: {
    backgroundColor: "#FEE2E2",
  },
  destructiveText: {
    color: "#DC2626",
  },
});
