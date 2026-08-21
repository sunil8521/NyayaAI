import { Injectable, Logger } from '@nestjs/common';
import { tool, StructuredTool } from '@langchain/core/tools';
import { z } from "zod";

@Injectable()
export class ToolsService {
    private readonly logger = new Logger(ToolsService.name);

    constructor(
        // You can inject other NestJS services here if needed
        // private readonly emailService: EmailService 
    ) {}

    getTools(): StructuredTool[] {
        const emailTool = tool(
            async ({ to, subject }) => {
                this.logger.log(`🔧 [Tool Call] send_email -> to: "${to}", subject: "${subject}"`);
                const result = `✅ Email sent to ${to} with subject: "${subject}"`;
                this.logger.log(`🔧 [Tool Result] send_email -> ${result}`);
                return result;
            },
            {
                name: 'send_email',
                description: 'Send an email to someone. Use this when the user asks to send an email.',
                schema: z.object({
                    to: z.string().describe('The email address to send to'),
                    subject: z.string().describe('The subject of the email'),
                }),
            }
        );

        const weatherTool = tool(
            async ({ place }) => {
                this.logger.log(`🔧 [Tool Call] weather -> place: "${place}"`);
                const result = `The weather of ${place} is cool.`;
                this.logger.log(`🔧 [Tool Result] weather -> ${result}`);
                return result;
            },
            {
                name: 'weather',
                description: 'Get the current weather for a specific location.',
                schema: z.object({
                    place: z.string().describe('The city or location name'),
                }),
            }
        );

        return [weatherTool, emailTool];
    }
}
