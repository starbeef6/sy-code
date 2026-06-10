import fs from 'fs';
import path from 'path';
import { isPathInsideDir, prepareTaskFolder, sanitizeSegment, uniquePath } from './task-folder.js';

export interface UploadedItemInput {
  name: string;
  sourcePath?: string;
  dataBase64?: string;
}

export async function importUploadedItems(
  taskFolder: string,
  items: UploadedItemInput[],
): Promise<{ inputDir: string; copiedPaths: string[] }> {
  const { inputDir } = prepareTaskFolder(taskFolder);
  const copiedPaths: string[] = [];

  for (const item of items) {
    const safeName = sanitizeSegment(item.name || 'upload', 'upload');
    const destination = uniquePath(path.join(inputDir, safeName));

    if (item.sourcePath) {
      await fs.promises.cp(item.sourcePath, destination, {
        recursive: true,
        errorOnExist: false,
        force: false,
      });
      copiedPaths.push(destination);
      continue;
    }

    if (typeof item.dataBase64 === 'string' && item.dataBase64.length > 0) {
      const buffer = Buffer.from(item.dataBase64, 'base64');
      await fs.promises.writeFile(destination, buffer);
      copiedPaths.push(destination);
      continue;
    }

    throw new Error(`Uploaded item "${item.name}" is missing source data`);
  }

  return { inputDir, copiedPaths };
}

export async function deleteUploadedItem(taskFolder: string, filePath: string): Promise<void> {
  const { inputDir } = prepareTaskFolder(taskFolder);
  if (!isPathInsideDir(filePath, inputDir)) {
    throw new Error('Uploaded file must be inside the current task input directory');
  }
  await fs.promises.rm(filePath, { recursive: true, force: true });
}

/**
 * Find the most recently modified non-log file under a directory tree.
 * Skips `output.log` and the per-run `*.log` artifacts so "open latest output"
 * lands on a real deliverable rather than a streaming log.
 */
export async function findLatestNonLogFile(directoryPath: string): Promise<string | null> {
  const stack = [directoryPath];
  let latestPath: string | null = null;
  let latestMtime = -Infinity;

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'runs') continue; // skip run logs
        stack.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === 'output.log' || entry.name.endsWith('.log')) continue;

      const stat = await fs.promises.stat(entryPath);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestPath = entryPath;
      }
    }
  }

  return latestPath;
}
