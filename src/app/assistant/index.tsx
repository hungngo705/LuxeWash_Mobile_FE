import { Header } from "@/components/ui/Header";
import {
  LuxeBorderRadius,
  LuxeColors,
  LuxeShadows,
  LuxeSpacing,
} from "@/constants/luxeTheme";
import { aiService, ApiError } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  intent?: string;
}

const QUICK_PROMPTS = [
  "Điểm hiện tại của tôi là bao nhiêu?",
  "Tôi đang ở hạng thành viên nào?",
  "Lần gần nhất tôi sử dụng dịch vụ là khi nào?",
  "Mã giới thiệu của tôi là gì?",
];

const INTENT_LABELS: Record<string, string> = {
  CHECK_POINTS: "Điểm thưởng",
  CHECK_TIER: "Hạng thành viên",
  LAST_VISIT: "Lần sử dụng gần nhất",
  REFERRAL: "Mã giới thiệu",
  RECOMMENDATION: "Gợi ý",
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Xin chào! Mình là trợ lý LuxeWash. Bạn có thể hỏi về điểm, hạng thành viên, lần sử dụng gần nhất hoặc mã giới thiệu.",
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.statusCode === 429) {
      return "Bạn đang gửi quá nhanh. Vui lòng chờ một chút rồi thử lại.";
    }
    return error.message;
  }
  return "Không thể kết nối với trợ lý. Vui lòng thử lại.";
};

export default function AssistantScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const loadRecommendation = useCallback(async () => {
    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const response = await aiService.getRecommendation();
      setRecommendation(response.data?.recommendation?.trim() ?? "");
    } catch (error) {
      setRecommendationError(getErrorMessage(error));
    } finally {
      setRecommendationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendation();
  }, [loadRecommendation]);

  const sendMessage = useCallback(
    async (preset?: string) => {
      const message = (preset ?? input).trim();
      if (!message || sending || message.length > 300) return;

      const timestamp = Date.now();
      const userMessage: ChatMessage = {
        id: `user-${timestamp}`,
        role: "user",
        text: message,
      };
      setMessages((current) => [...current, userMessage]);
      setInput("");
      setSending(true);

      try {
        const response = await aiService.chat({ message });
        const reply = response.data?.reply?.trim();
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${timestamp}`,
            role: "assistant",
            text: reply || "Mình chưa có câu trả lời phù hợp. Bạn thử hỏi theo cách khác nhé.",
            intent: response.data?.intent,
          },
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: `error-${timestamp}`,
            role: "assistant",
            text: getErrorMessage(error),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [input, sending],
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const intentLabel = item.intent ? INTENT_LABELS[item.intent] : undefined;
    return (
      <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
        {!isUser ? (
          <View style={styles.botAvatar}>
            <Feather name="message-circle" size={17} color={LuxeColors.primary} />
          </View>
        ) : null}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
          {intentLabel ? <Text style={styles.intentLabel}>{intentLabel}</Text> : null}
          <Text selectable style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <View style={styles.recommendationTitleRow}>
            <View style={styles.sparkleIcon}>
              <Feather name="star" size={17} color="#B45309" />
            </View>
            <Text style={styles.recommendationTitle}>Gợi ý dành riêng cho bạn</Text>
          </View>
          <TouchableOpacity onPress={loadRecommendation} disabled={recommendationLoading}>
            <Feather name="refresh-cw" size={17} color={LuxeColors.primary} />
          </TouchableOpacity>
        </View>
        {recommendationLoading ? (
          <View style={styles.recommendationLoading}>
            <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
            <Text style={styles.recommendationText}>Đang phân tích hồ sơ của bạn...</Text>
          </View>
        ) : recommendationError ? (
          <TouchableOpacity onPress={loadRecommendation}>
            <Text selectable style={styles.recommendationError}>{recommendationError}</Text>
            <Text style={styles.retryRecommendation}>Chạm để thử lại</Text>
          </TouchableOpacity>
        ) : (
          <Text selectable style={styles.recommendationText}>
            {recommendation || "Hoàn thiện hồ sơ và thêm xe để nhận gợi ý phù hợp hơn."}
          </Text>
        )}
      </View>

      <Text style={styles.quickTitle}>Câu hỏi gợi ý</Text>
      <View style={styles.quickPrompts}>
        {QUICK_PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt}
            style={styles.quickPrompt}
            onPress={() => sendMessage(prompt)}
            disabled={sending}
          >
            <Text style={styles.quickPromptText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.conversationTitle}>Trò chuyện</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Header title="Trợ lý LuxeWash" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListHeaderComponent={listHeader}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {sending ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={LuxeColors.primaryContainer} />
            <Text style={styles.typingText}>Trợ lý đang trả lời...</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Nhập câu hỏi của bạn..."
              placeholderTextColor={LuxeColors.outline}
              multiline
              maxLength={300}
              style={styles.input}
              editable={!sending}
              accessibilityLabel="Câu hỏi cho trợ lý LuxeWash"
            />
            <Text style={styles.characterCount}>{input.length}/300</Text>
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || sending}
            accessibilityLabel="Gửi câu hỏi"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={19} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LuxeColors.background },
  keyboardView: { flex: 1 },
  listContent: { padding: LuxeSpacing.lg, paddingBottom: LuxeSpacing.xl },
  listHeader: { gap: LuxeSpacing.md, marginBottom: LuxeSpacing.lg },
  recommendationCard: {
    padding: LuxeSpacing.lg,
    gap: LuxeSpacing.md,
    borderRadius: LuxeBorderRadius.xl,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    ...LuxeShadows.sm,
  },
  recommendationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recommendationTitleRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  sparkleIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF3C7" },
  recommendationTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: LuxeColors.onSurface },
  recommendationLoading: { flexDirection: "row", alignItems: "center", gap: 10 },
  recommendationText: { flex: 1, fontSize: 14, lineHeight: 20, color: LuxeColors.onSurfaceVariant },
  recommendationError: { fontSize: 13, lineHeight: 18, color: LuxeColors.error },
  retryRecommendation: { marginTop: 5, fontSize: 12, fontWeight: "700", color: LuxeColors.primary },
  quickTitle: { fontSize: 13, fontWeight: "700", color: LuxeColors.onSurfaceVariant },
  quickPrompts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPrompt: { maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: LuxeBorderRadius.full, backgroundColor: LuxeColors.primaryContainer + "18", borderWidth: 1, borderColor: LuxeColors.primaryContainer + "35" },
  quickPromptText: { fontSize: 12, fontWeight: "600", color: LuxeColors.primary },
  conversationTitle: { marginTop: LuxeSpacing.sm, fontSize: 17, fontWeight: "700", color: LuxeColors.onSurface },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: LuxeSpacing.md, paddingRight: 46 },
  userMessageRow: { justifyContent: "flex-end", paddingRight: 0, paddingLeft: 46 },
  botAvatar: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: LuxeColors.primaryContainer + "20" },
  messageBubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  botBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 5, ...LuxeShadows.sm },
  userBubble: { backgroundColor: LuxeColors.primary, borderBottomRightRadius: 5 },
  messageText: { fontSize: 14, lineHeight: 20, color: LuxeColors.onSurface },
  userMessageText: { color: "#FFFFFF" },
  intentLabel: { marginBottom: 4, fontSize: 10, fontWeight: "800", color: LuxeColors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: LuxeSpacing.lg, paddingBottom: LuxeSpacing.sm },
  typingText: { fontSize: 12, color: LuxeColors.onSurfaceVariant },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: LuxeSpacing.md, paddingTop: LuxeSpacing.sm, paddingBottom: LuxeSpacing.md, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: LuxeColors.outlineVariant + "35" },
  inputWrap: { flex: 1, minHeight: 48, maxHeight: 116, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 17, backgroundColor: LuxeColors.surfaceContainerLow, borderWidth: 1, borderColor: LuxeColors.outlineVariant },
  input: { minHeight: 26, maxHeight: 72, padding: 0, fontSize: 14, lineHeight: 19, color: LuxeColors.onSurface, textAlignVertical: "top" },
  characterCount: { alignSelf: "flex-end", marginTop: 2, fontSize: 10, color: LuxeColors.outline, fontVariant: ["tabular-nums"] },
  sendButton: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: LuxeColors.primary },
  sendButtonDisabled: { opacity: 0.45 },
});
