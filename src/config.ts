import { formatBytesToString } from './utils/format_bytes_to_string';

export const ENVIRONMENT = process.env.NODE_ENV || '';
export const VERCEL_URL = process.env.VERCEL_URL || '';
export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const REDIS_URL = process.env.REDIS_URL || '';

export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'whisper-large-v3-turbo';

export const MAX_FILE_SIZE = parseInt(
  process.env.MAX_FILE_SIZE || '10485760',
  10,
);
export const MAX_DURATION = parseInt(process.env.MAX_DURATION || '0', 10);

export const USER_RATE_LIMIT = parseInt(process.env.USER_RATE_LIMIT || '0', 10);
export const USER_REQUEST_WINDOW = parseInt(
  process.env.USER_REQUEST_WINDOW || '0',
  10,
);

export const GLOBAL_RATE_LIMIT = parseInt(
  process.env.USER_RATE_LIMIT || '0',
  10,
);
export const GLOBAL_REQUEST_WINDOW = parseInt(
  process.env.GLOBAL_REQUEST_WINDOW || '0',
  10,
);

export const MAX_FILE_SIZE_FORMATTED = formatBytesToString(MAX_FILE_SIZE);
