export interface ChatRequest {
  message: string;
  threadId: string;
}

export interface ChatResponse {
  response: string;
  threadId: string;
}

export async function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Chat request failed with status ${res.status}`);
  }

  return res.json();
}
