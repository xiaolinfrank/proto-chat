import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Utility class for safely storing temporary files
 */
export class TempFileManager {
  private readonly tempDir: string;
  private filePaths: Set<string> = new Set();

  constructor(dirname: string) {
    // Create a unique temp directory (cross-platform safe)
    this.tempDir = mkdtempSync(join(tmpdir(), dirname));
    // Register exit cleanup hook
    this.registerCleanupHook();
  }

  /**
   * Write a Uint8Array to a temporary file
   */
  async writeTempFile(data: Uint8Array, name: string): Promise<string> {
    const filePath = join(this.tempDir, name);

    try {
      writeFileSync(filePath, data);
      this.filePaths.add(filePath);
      return filePath;
    } catch (error) {
      this.cleanup(); // Immediately clean up on write failure
      throw new Error(`Failed to write temp file: ${(error as Error).message}`);
    }
  }

  /**
   * Safely clean up temporary resources
   */
  cleanup(): void {
    if (existsSync(this.tempDir)) {
      // Recursively delete the directory and its contents
      rmSync(this.tempDir, { force: true, recursive: true });
      this.filePaths.clear();
    }
  }

  /**
   * Register automatic cleanup on process exit or error
   */
  private registerCleanupHook(): void {
    // Normal exit
    process.on('exit', () => this.cleanup());
    // Abnormal exit
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception, cleaning temp files:', err);
      this.cleanup();
      process.exit(1);
    });
    // Signal termination
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        this.cleanup();
        process.exit(0);
      });
    });
  }
}
