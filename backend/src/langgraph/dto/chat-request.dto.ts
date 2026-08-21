export class ChatRequestDto {
    readonly message: string;
    readonly threadId: string; // Used by MemorySaver to track distinct user sessions
}