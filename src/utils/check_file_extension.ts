import { SUPPORTED_FILE_EXTENSIONS } from '../constants';

export function checkFileExtension(extension: string): boolean {
  return extension ? SUPPORTED_FILE_EXTENSIONS.has(extension) : false;
}
