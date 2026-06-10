export function basenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/u).filter(Boolean).pop() ?? filePath;
}
