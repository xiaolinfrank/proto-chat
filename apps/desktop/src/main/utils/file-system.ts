import { mkdirSync, statSync } from 'node:fs';

export const makeSureDirExist = (dir: string) => {
  try {
    statSync(dir);
  } catch {
    // Use recursive: true — no-op if the directory already exists, creates it otherwise
    try {
      mkdirSync(dir, { recursive: true });
    } catch (mkdirError: any) {
      // If directory creation fails (e.g. permission issues), throw an error
      throw new Error(`Could not create target directory: ${dir}. Error: ${mkdirError.message}`);
    }
  }
};
