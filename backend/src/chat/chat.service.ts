import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogle } from "@langchain/google";

@Injectable()
export class ChatService implements OnModuleInit {

    private llm!: ChatGoogle;
    constructor(private readonly configService: ConfigService) {
    }

    async onModuleInit(): Promise<void> {
        this.llm = new ChatGoogle({
            model: this.configService.get<string>("MODEL_NAME") as string,
            apiKey: this.configService.get<string>("GEMINI_KEY"),
        })

    }

    public getLlm(): ChatGoogle {
        return this.llm;
    }
}
