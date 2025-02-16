import { SUPPORTED_FILE_EXTENSIONS } from '../constants';

export function checkFileExtension(filename: string): boolean {
  try {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? SUPPORTED_FILE_EXTENSIONS.has(ext) : false;
  } catch (error) {
    console.error('Error checking file extension:', error);
    return false;
  }
}
