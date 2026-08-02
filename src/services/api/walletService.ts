/**
 * Wallet API Service
 * Handles wallet balance, top-up, and transactions
 *
 * Nhóm API ví điện tử: xem số dư, nạp tiền và lịch sử giao dịch.
 */

import { apiClient, ApiResponse } from "./client";

/** Số dư ví và điểm tích luỹ của người dùng */
export interface WalletBalance {
  balance: number; // Số dư tiền trong ví
  totalPoints: number; // Tổng điểm thưởng
  promotionPoints: number; // Điểm khuyến mãi
}

/** Dữ liệu yêu cầu nạp tiền (kèm URL callback khi thanh toán xong/huỷ) */
export interface TopUpRequest {
  amount: number;
  cancelUrl: string; // URL chuyển về khi người dùng huỷ thanh toán
  returnUrl: string; // URL chuyển về khi thanh toán thành công
}

/** Các loại giao dịch: nạp tiền, đặt lịch, hoàn tiền, bán thêm, thưởng/đổi điểm */
export type TransactionType =
  | "TopUp"
  | "Booking"
  | "Refund"
  | "Upsell"
  | "PointReward"
  | "PointRedeem";
/** Trạng thái giao dịch */
export type TransactionStatus = "Completed" | "Pending" | "Failed";

/** Một bản ghi giao dịch trong ví */
export interface Transaction {
  transactionId: number;
  amount: number;
  transactionType: TransactionType;
  description: string;
  createdAt: string;
  status: TransactionStatus;
  referenceId?: string; // Mã tham chiếu (vd mã đơn thanh toán)
}

export const walletService = {
  /** Lấy số dư ví hiện tại */
  getBalance: async (): Promise<ApiResponse<WalletBalance>> => {
    return apiClient.get<WalletBalance>("/wallets/me");
  },

  /** Tạo yêu cầu nạp tiền, trả về link thanh toán và mã đơn */
  topUp: async (
    data: TopUpRequest,
  ): Promise<ApiResponse<{ paymentUrl: string; orderCode: string }>> => {
    return apiClient.post<{ paymentUrl: string; orderCode: string }>(
      "/wallets/top-up",
      data,
    );
  },

  /** Lấy lịch sử giao dịch của ví */
  getTransactions: async (): Promise<ApiResponse<Transaction[]>> => {
    return apiClient.get<Transaction[]>("/transactions");
  },
};
