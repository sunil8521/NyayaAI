import { useMutation } from "@tanstack/react-query";
import { sendChatMessage, type ChatRequest, type ChatResponse } from "@/lib/api/chat";

export function useChatMutation() {
  return useMutation<ChatResponse, Error, ChatRequest>({
    mutationFn: (data: ChatRequest) => sendChatMessage(data),
  });
}
