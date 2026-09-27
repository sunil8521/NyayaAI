 import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllChats,
  fetchChatHistory,
  createNewChat,
  sendChatMessage,
  streamChatMessage,
  deleteChatThread,
  type ChatSession,
  type ChatMessage,
  type SourceCitation,
} from "@/lib/api/chat";
import { useCallback, useRef, useState } from "react";

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

// 4. Streaming Message Hook — uses SSE for real-time token streaming
export function useStreamMessage() {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const send = useCallback(
    async (threadId: string, message: string) => {
      if (isStreamingRef.current) return;
      isStreamingRef.current = true;

      setIsStreaming(true);
      setError(null);
      abortRef.current = false;

      const historyKey = ["chat", threadId, "history"];

      // Cancel any in-flight refetches so they can't overwrite our optimistic data
      await queryClient.cancelQueries({ queryKey: historyKey });

      // Snapshot previous messages for rollback
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(historyKey) || [];

      // Optimistically append user message + empty AI placeholder
      queryClient.setQueryData<ChatMessage[]>(historyKey, [
        ...previousMessages,
        { role: "user", content: message },
        { role: "ai", content: "" },
      ]);

      try {
        await streamChatMessage(threadId, message, {
          onToken: (token) => {
            if (abortRef.current) return;
            queryClient.setQueryData<ChatMessage[]>(historyKey, (old) => {
              if (!old || old.length === 0) return old;
              const updated = [...old];
              const lastMsg = { ...updated[updated.length - 1] };
              lastMsg.content += token;
              updated[updated.length - 1] = lastMsg;
              return updated;
            });
          },
          onSources: (sources: SourceCitation[]) => {
            if (abortRef.current) return;
            queryClient.setQueryData<ChatMessage[]>(historyKey, (old) => {
              if (!old || old.length === 0) return old;
              const updated = [...old];
              const lastMsg = { ...updated[updated.length - 1] };
              lastMsg.sources = sources;
              updated[updated.length - 1] = lastMsg;
              return updated;
            });
          },
          onDone: () => {
            // Don't invalidate here! This fires when the backend sends the 'done'
            // SSE event, but the backend saves messages to MongoDB AFTER this event.
            // Invalidating here would refetch stale data and wipe the optimistic cache.
          },
          onError: (errMsg) => {
            setError(errMsg);
          },
        });

        // Sync cache with MongoDB after stream + save complete.
        // Wrapped in try/catch: a refetch failure here is NOT a stream error.
        try {
          await queryClient.invalidateQueries({ queryKey: historyKey });
          await queryClient.invalidateQueries({ queryKey: ["chats"] });
        } catch {
          // Refetch failed (e.g. network blip) — the optimistic cache is still correct.
        }
      } catch (err: any) {
        setError(err.message || "Stream failed");
        queryClient.setQueryData(historyKey, previousMessages);
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
      }
    },
    [queryClient],
  );

  return { send, isStreaming, error };
}

// 4b. Mutation: Send Message (non-streaming fallback)
export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, message }: { threadId: string; message: string }) =>
      sendChatMessage(threadId, message),
    onMutate: async ({ threadId, message }) => {
      // Cancel outgoing queries so they don't overwrite optimistic update
      await queryClient.cancelQueries({
        queryKey: ["chat", threadId, "history"],
      });

      // Snapshot previous messages
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(["chat", threadId, "history"]) || [];

      // Optimistically append the user message to the query cache
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", threadId, "history"],
        [...previousMessages, { role: "user", content: message }],
      );

      return { previousMessages, threadId };
    },
    onError: (err, variables, context) => {
      // Rollback on failure
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["chat", context.threadId, "history"],
          context.previousMessages,
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate to fetch canonical data from server
      if (variables?.threadId) {
        queryClient.invalidateQueries({
          queryKey: ["chat", variables.threadId, "history"],
        });
      }
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
        (old || []).filter((c) => c.threadId !== threadId),
      );
      // Remove history cache for this thread
      queryClient.removeQueries({
        queryKey: ["chat", threadId, "history"],
      });
    },
  });
}
