import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import type { Readable } from 'stream';

@Injectable()
export class GoogleDriveService {
  private readonly drive: drive_v3.Drive;
  private readonly folderId: string;

  constructor(private readonly configService: ConfigService) {
    const auth = new google.auth.JWT({
      email: this.configService.get<string>('GDRIVE_CLIENT_EMAIL'),
      key: this.configService.get<string>('GDRIVE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.folderId = this.configService.get<string>('GDRIVE_FOLDER_ID', '');
  }

  /**
   * Lists PDFs in the target folder that aren't already tracked.
   * Replace knownFileIds with a real DB lookup once you have a documents table.
   */
  async listNewPdfs(knownFileIds: Set<string>): Promise<drive_v3.Schema$File[]> {
    const res = await this.drive.files.list({
      q: `'${this.folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id, name, modifiedTime, md5Checksum)',
      pageSize: 1000,
    });
    const files = res.data.files ?? [];
    return files.filter((f) => f.id && !knownFileIds.has(f.id));
  }

  /**
   * Streams a PDF from Drive directly to a temp file on disk.
   * This avoids loading the entire file into RAM — safe for large PDFs.
   */
  async streamPdfToDisk(fileId: string, destPath: string): Promise<void> {
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    );
    await pipeline(res.data as Readable, createWriteStream(destPath));
  }

  /** Download a small PDF directly into memory (for files < 50MB). */
  async downloadPdf(fileId: string): Promise<Buffer> {
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }
}
