import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GoogleDriveService } from './google-drive.service';

@Controller('ingestion')
export class IngestionController {
  constructor(
    @InjectQueue('document-ingestion') private readonly queue: Queue,
    private readonly driveService: GoogleDriveService,
  ) {}

  /** Manual PDF upload — for local testing before Drive sync is wired up. */
  @Post('upload')
  @AllowAnonymous() // TODO: restrict to admin role later
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    const jobId = `manual-${Date.now()}`;
    await this.queue.add(
      'process-document',
      {
        source: 'upload',
        fileName: file.originalname,
        fileBuffer: file.buffer.toString('base64'),
      },
      { jobId },
    );
    return { queued: true, jobId };
  }

  /** Triggers a Drive folder scan and enqueues any PDFs not seen before. */
  @Post('sync')
  @AllowAnonymous() // TODO: restrict to admin role later
  async syncFromDrive() {
    // TODO: replace with a real lookup against your documents collection
    const knownFileIds = new Set<string>();
    const newFiles = await this.driveService.listNewPdfs(knownFileIds);

    for (const file of newFiles) {
      await this.queue.add(
        'process-document',
        { source: 'drive', driveFileId: file.id, fileName: file.name },
        { jobId: `drive-${file.id}` },
      );
    }

    return { queued: newFiles.length };
  }
}
