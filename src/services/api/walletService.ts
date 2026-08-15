/**
 * Wallet API Service
 * Handles wallet balance, top-up, and transactions
 */

import { apiClient, ApiResponse } from "./client";

export interface WalletBalance {
  balance: number;
  totalPoints: number;
  promotionPoints: number;
}

export interface TopUpRequest {
  amount: number;
  cancelUrl: string;
  returnUrl: string;
}

export type TransactionType =
  | "TopUp"
  | "Booking"
  | "Refund"
  | "Upsell"
  | "PointReward"
  | "PointRedeem";
export type TransactionStatus = "Completed" | "Pending" | "Failed";

export interface Transaction {
  transactionId: number;
  amount: number;
  transactionType: TransactionType;
  description: string;
  createdAt: string;
  status: TransactionStatus;
  referenceId?: string;
}

export const walletService = {
  getBalance: async (): Promise<ApiResponse<WalletBalance>> => {
    return apiClient.get<WalletBalance>("/wallets/me");
  },

  topUp: async (
    data: TopUpRequest,
  ): Promise<ApiResponse<{ paymentUrl: string; orderCode: string }>> => {
    return apiClient.post<{ paymentUrl: string; orderCode: string }>(
      "/wallets/top-up",
      data,
    );
  },

  getTransactions: async (): Promise<ApiResponse<Transaction[]>> => {
    return apiClient.get<Transaction[]>("/transactions");
  },
};
