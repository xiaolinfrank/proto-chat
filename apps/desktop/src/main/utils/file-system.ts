import { mkdirSync, statSync } from 'node:fs';

export const makeSureDirExist = (dir: string) => {
  try {
    statSync(dir);
  } catch {
    // Use recursive: true; if the directory already exists, this is a no-op; otherwise it creates it
    try {
      mkdirSync(dir, { recursive: true });
    } catch (mkdirError: any) {
      // If creating the directory fails (e.g., permission issues), throw an error
      throw new Error(`Could not create target directory: ${dir}. Error: ${mkdirError.message}`);
    }
  }
};
