/** API dành cho trợ lý AI của khách hàng LuxeWash. */

import { apiClient, type ApiResponse } from './client';

export interface AIChatRequest {
  message: string;
}

export interface AIChatResponse {
  reply: string;
  intent: string;
}

export interface AIRecommendationResponse {
  recommendation: string;
}

export const aiService = {
  /** Gửi một câu hỏi tối đa 300 ký tự tới trợ lý Customer. */
  chat: async (data: AIChatRequest): Promise<ApiResponse<AIChatResponse>> => {
    return apiClient.post<AIChatResponse>('/ai/chat', data);
  },

  /** Lấy gợi ý cá nhân hoá dựa trên hồ sơ, điểm, xe và lịch sử sử dụng. */
  getRecommendation: async (): Promise<ApiResponse<AIRecommendationResponse>> => {
    return apiClient.get<AIRecommendationResponse>('/ai/recommendation');
  },
};
