import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { IngestionController } from './ingestion.controller';
import { IngestionProcessor } from './ingestion.processor';
import { GoogleDriveService } from './google-drive.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'document-ingestion',
    }),
  ],
  controllers: [IngestionController],
  providers: [IngestionProcessor, GoogleDriveService, EmbeddingService],
  exports: [EmbeddingService],

})
export class IngestionModule { }
