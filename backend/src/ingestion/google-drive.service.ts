import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import type { Readable } from 'stream';

export interface DrivePdfFile {
  id: string;
  name: string;
  folderPath: string;
  fileSizeBytes?: number;
  modifiedTime?: string;
}

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
   * Recursively traverses all folders and subfolders starting from the root folderId.
   * Returns a flat array of all PDFs with their relative folder path.
   */
  async listAllPdfsRecursively(
    folderId: string = this.folderId,
    currentPath: string = '',
  ): Promise<DrivePdfFile[]> {
    if (!folderId) return [];
    const allFiles: DrivePdfFile[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 1000,
        pageToken,
      });

      const items: any[] = res.data.files ?? [];
      pageToken = res.data.nextPageToken;

      for (const item of items) {
        if (item.mimeType === 'application/pdf' && item.id) {
          allFiles.push({
            id: item.id,
            name: item.name || 'unnamed.pdf',
            folderPath: currentPath || '/',
            fileSizeBytes: item.size ? parseInt(item.size, 10) : undefined,
            modifiedTime: item.modifiedTime,
          });
        } else if (item.mimeType === 'application/vnd.google-apps.folder' && item.id) {
          // Recurse into subfolder
          const subPath = currentPath ? `${currentPath}/${item.name}` : item.name;
          const subFiles = await this.listAllPdfsRecursively(item.id, subPath);
          allFiles.push(...subFiles);
        }
      }
    } while (pageToken);

    return allFiles;
  }

  /**
   * Lists only new PDFs across all subfolders that aren't already tracked in the database.
   */
  async listNewPdfs(knownFileIds: Set<string>): Promise<DrivePdfFile[]> {
    const allFiles = await this.listAllPdfsRecursively(this.folderId);
    return allFiles.filter((f) => !knownFileIds.has(f.id));
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
