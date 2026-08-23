export interface ChatSession {
  _id: string;
  userId: string;
  threadId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "ai" | "system" | "assistant";
  content: string;
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

// 4. Send a message to a specific thread
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
