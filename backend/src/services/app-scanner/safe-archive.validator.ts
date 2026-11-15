import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import yauzl, { type ZipFile, type Entry } from 'yauzl';

export const MAX_APK_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB
export const MAX_TOTAL_ENTRIES = 10_000;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150 MB
export const MAX_COMPRESSION_RATIO = 100; // 100:1 Zip bomb defense

export class ArchiveSecurityError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ArchiveSecurityError';
    this.code = code;
  }
}

export interface ArchiveValidationResult {
  sha256: string;
  fileSizeBytes: number;
  totalEntries: number;
  totalUncompressedBytes: number;
  hasAndroidManifest: boolean;
}

/**
 * Validates untrusted APK archives against corruption, ZIP bombs, ZipSlip path traversal,
 * and oversized resource allocations before static analysis.
 */
export async function validateApkArchive(filePath: string): Promise<ArchiveValidationResult> {
  const stat = await fs.stat(filePath);

  if (stat.size > MAX_APK_FILE_SIZE_BYTES) {
    throw new ArchiveSecurityError(
      `APK file size (${(stat.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 35 MB.`,
      'FILE_TOO_LARGE',
    );
  }

  if (stat.size < 30) {
    throw new ArchiveSecurityError('The provided file is too small to be a valid Android APK.', 'CORRUPT_ARCHIVE');
  }

  // Verify ZIP magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  const headerBuf = Buffer.alloc(4);
  const handle = await fs.open(filePath, 'r');
  try {
    await handle.read(headerBuf, 0, 4, 0);
  } finally {
    await handle.close();
  }

  if (
    headerBuf[0] !== 0x50 ||
    headerBuf[1] !== 0x4b ||
    headerBuf[2] !== 0x03 ||
    headerBuf[3] !== 0x04
  ) {
    throw new ArchiveSecurityError(
      'Invalid file signature. Uploaded file does not have a valid ZIP/APK header.',
      'INVALID_ZIP_HEADER',
    );
  }

  // Calculate cryptographic SHA-256 hash using streaming
  const hash = createHash('sha256');
  const fileStream = await fs.readFile(filePath);
  hash.update(fileStream);
  const sha256 = hash.digest('hex');

  // Inspect central directory using yauzl (safe streaming without extracting to disk)
  return new Promise<ArchiveValidationResult>((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, autoClose: true, decodeStrings: true },
      (err: Error | null, zipfile: ZipFile | undefined) => {
        if (err || !zipfile) {
          reject(new ArchiveSecurityError('Unable to parse APK archive table of contents.', 'CORRUPT_ZIP'));
          return;
        }

        let entryCount = 0;
        let totalUncompressedBytes = 0;
        let hasAndroidManifest = false;

        zipfile.on('entry', (entry: Entry) => {
          entryCount += 1;

          // 1. Check entry count limit (Zip bomb defense)
          if (entryCount > MAX_TOTAL_ENTRIES) {
            zipfile.close();
            reject(
              new ArchiveSecurityError(
                `Archive entry count (${entryCount}) exceeds safe limit of ${MAX_TOTAL_ENTRIES} files.`,
                'ENTRY_COUNT_EXCEEDED',
              ),
            );
            return;
          }

          // 2. Check path traversal (ZipSlip defense)
          const name = entry.fileName;
          if (
            name.includes('..') ||
            name.startsWith('/') ||
            name.startsWith('\\') ||
            name.includes('\u0000') ||
            /^[a-zA-Z]:/.test(name)
          ) {
            zipfile.close();
            reject(
              new ArchiveSecurityError(
                `Unsafe archive entry path detected: "${name}". Path traversal not permitted.`,
                'PATH_TRAVERSAL_DETECTED',
              ),
            );
            return;
          }

          if (name === 'AndroidManifest.xml') {
            hasAndroidManifest = true;
          }

          // 3. Check cumulative uncompressed bytes
          totalUncompressedBytes += entry.uncompressedSize;
          if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            zipfile.close();
            reject(
              new ArchiveSecurityError(
                `Cumulative uncompressed archive size (${(totalUncompressedBytes / (1024 * 1024)).toFixed(1)} MB) exceeds limit.`,
                'UNCOMPRESSED_SIZE_EXCEEDED',
              ),
            );
            return;
          }

          // 4. Check individual file compression ratio
          if (
            entry.compressedSize > 0 &&
            entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO &&
            entry.uncompressedSize > 1024 * 1024
          ) {
            zipfile.close();
            reject(
              new ArchiveSecurityError(
                `Suspicious compression ratio on "${name}" (${(entry.uncompressedSize / entry.compressedSize).toFixed(0)}x). Possible Zip bomb.`,
                'ZIP_BOMB_DETECTED',
              ),
            );
            return;
          }

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          if (!hasAndroidManifest) {
            reject(
              new ArchiveSecurityError(
                'Missing AndroidManifest.xml. The uploaded archive is not a valid Android application package.',
                'MISSING_MANIFEST',
              ),
            );
            return;
          }

          resolve({
            sha256,
            fileSizeBytes: stat.size,
            totalEntries: entryCount,
            totalUncompressedBytes,
            hasAndroidManifest: true,
          });
        });

        zipfile.on('error', (zipErr: Error) => {
          const isTraversal =
            zipErr.message?.toLowerCase().includes('relative path') ||
            zipErr.message?.includes('..');
          if (isTraversal) {
            reject(
              new ArchiveSecurityError(
                `Unsafe archive entry path detected: ${zipErr.message}`,
                'PATH_TRAVERSAL_DETECTED',
              ),
            );
            return;
          }
          reject(new ArchiveSecurityError(`ZIP decompression error: ${zipErr.message}`, 'ZIP_READ_ERROR'));
        });

        zipfile.readEntry();
      },
    );
  });
}
