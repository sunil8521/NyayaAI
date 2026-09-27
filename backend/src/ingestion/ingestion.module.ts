import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { IngestionController } from './ingestion.controller';
import { IngestionProcessor } from './ingestion.processor';
import { GoogleDriveService } from './google-drive.service';
import { EmbeddingService } from './embedding.service';
import { DriveSyncWorker } from './drive-sync.worker';
import { IngDoc, IngDocSchema } from './schemas/ingested-document.schema';
import { SyncState, SyncStateSchema } from './schemas/sync-state.schema';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'document-ingestion',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    }),
    MongooseModule.forFeature([
      { name: IngDoc.name, schema: IngDocSchema },
      { name: SyncState.name, schema: SyncStateSchema },
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionProcessor, GoogleDriveService, EmbeddingService, DriveSyncWorker],
  exports: [EmbeddingService],
})
export class IngestionModule {}
