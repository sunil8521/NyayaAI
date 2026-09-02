import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { IngestionController } from './ingestion.controller';
import { IngestionProcessor } from './ingestion.processor';
import { GoogleDriveService } from './google-drive.service';
import { EmbeddingService } from './embedding.service';
import { IngDoc, IngDocSchema } from './schemas/ingested-document.schema';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'document-ingestion',
    }),
    MongooseModule.forFeature([
      { name: IngDoc.name, schema: IngDocSchema },
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionProcessor, GoogleDriveService, EmbeddingService],
  exports: [EmbeddingService],
})
export class IngestionModule {}
