import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'; // 👈 Import decorator

@Controller('chat')
export class LanggraphController {

    constructor(private readonly workflowService: WorkflowService) {



    }
    @Post()
    @HttpCode(HttpStatus.OK)
    @AllowAnonymous()
    async handleChat(@Body() chatRequestDto: ChatRequestDto) {
        const { message, threadId } = chatRequestDto;
        const inputMessages = [{ role: 'user', content: message }];

        const result = await this.workflowService.executeChat(inputMessages, threadId);
        const finalMessages = result.messages;

        const lastMessage = finalMessages[finalMessages.length - 1];

        return {
            response: lastMessage.content,
            threadId: threadId,
        };

    }
}
