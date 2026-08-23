import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllChats,
  fetchChatHistory,
  createNewChat,
  sendChatMessage,
  deleteChatThread,
  type ChatSession,
  type ChatMessage,
} from "@/lib/api/chat";

// 1. Sidebar Chats List Query Options
export const chatsQueryOptions = queryOptions({
  queryKey: ["chats"],
  queryFn: fetchAllChats,
  staleTime: 60 * 1000,
});

// 2. Chat History Query Options
export const chatHistoryQueryOptions = (threadId?: string) =>
  queryOptions({
    queryKey: ["chat", threadId, "history"],
    queryFn: () => fetchChatHistory(threadId!),
    enabled: !!threadId,
    staleTime: 30 * 1000,
  });

// 3. Mutation: Create New Chat
export function useCreateChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNewChat,
    onSuccess: (data) => {
      // Optimistically prepend to sidebar chats
      queryClient.setQueryData<ChatSession[]>(["chats"], (old) => [
        data.chat,
        ...(old || []),
      ]);
    },
  });
}

// 4. Mutation: Send Message
export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, message }: { threadId: string; message: string }) =>
      sendChatMessage(threadId, message),
    onSuccess: (data, variables) => {
      // Invalidate the chat history for this thread
      queryClient.invalidateQueries({
        queryKey: ["chat", variables.threadId, "history"],
      });
      // Invalidate sidebar chats to refresh updated title / updatedAt
      queryClient.invalidateQueries({
        queryKey: ["chats"],
      });
    },
  });
}

// 5. Mutation: Delete Chat
export function useDeleteChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => deleteChatThread(threadId),
    onSuccess: (_, threadId) => {
      // Remove chat from sidebar cache
      queryClient.setQueryData<ChatSession[]>(["chats"], (old) =>
        (old || []).filter((c) => c.threadId !== threadId)
      );
      // Remove history cache for this thread
      queryClient.removeQueries({
        queryKey: ["chat", threadId, "history"],
      });
    },
  });
}
