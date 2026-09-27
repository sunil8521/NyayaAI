export interface ChatSession {
  _id: string;
  userId: string;
  threadId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceCitation {
  fileName: string;
  pageStart: number;
  pageEnd: number;
  chunkIndex: number;
  docType?: string;
  jurisdiction?: string;
  excerpt?: string;
}

export interface ChatMessage {
  role: "user" | "ai" | "system" | "assistant";
  content: string;
  sources?: SourceCitation[];
  createdAt?: string;
}

export interface ChatsResponse {
  success: boolean;
  chats: ChatSession[];
}

export interface CreateChatResponse {
  success: boolean;
  chat: ChatSession;
  threadId: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  success: boolean;
  message: string;
  response?: string;
}

// 1. Fetch all chats for the sidebar
export async function fetchAllChats(): Promise<ChatSession[]> {
  const res = await fetch("/api/chat", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch chats (${res.status})`);
  }

  const data: ChatsResponse = await res.json();
  return data.chats || [];
}

// 2. Create a new empty chat thread
export async function createNewChat(): Promise<CreateChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to create chat (${res.status})`);
  }

  return res.json();
}

// 3. Fetch message history for a specific chat thread
export async function fetchChatHistory(threadId: string): Promise<ChatMessage[]> {
  if (!threadId) return [];

  const res = await fetch(`/api/chat/${threadId}/history`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch chat history (${res.status})`);
  }

  const data: ChatHistoryResponse = await res.json();
  return data.messages || [];
}

// 4. Send a message to a specific thread (non-streaming fallback)
export async function sendChatMessage(
  threadId: string,
  message: string
): Promise<SendMessageResponse> {
  const res = await fetch(`/api/chat/${threadId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to send message (${res.status})`);
  }

  return res.json();
}

// 4b. Stream a message via SSE — calls the streaming endpoint
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources: (sources: SourceCitation[]) => void;
  onDone: (fullText: string, sources: SourceCitation[]) => void;
  onError: (error: string) => void;
}

export async function streamChatMessage(
  threadId: string,
  message: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const res = await fetch(`/api/chat/${threadId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to stream message (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the incomplete last line in the buffer

      let currentEvent = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);

            switch (currentEvent) {
              case "token":
                callbacks.onToken(data.token);
                break;
              case "sources":
                callbacks.onSources(data.sources);
                break;
              case "done":
                callbacks.onDone(data.fullText, data.sources || []);
                break;
              case "error":
                callbacks.onError(data.error || "Unknown error");
                break;
            }
          } catch {
            // Skip malformed JSON lines
          }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// 5. Delete a chat thread
export async function deleteChatThread(threadId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/chat/${threadId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to delete chat (${res.status})`);
  }

  return res.json();
}
