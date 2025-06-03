import { formatBytesToString } from './utils/format_bytes_to_string';

export const ENVIRONMENT = process.env.NODE_ENV || '';
export const VERCEL_URL = process.env.VERCEL_URL || '';
export const BOT_TOKEN = process.env.BOT_TOKEN || '';

export const KV_REST_API_URL = process.env.KV_REST_API_URL;
export const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'whisper-large-v3-turbo';
export const GROQ_TRANSLATE_MODEL =
  process.env.GROQ_TRANSLATE_MODEL || 'whisper-large-v3';

export const DATABASE_URL = process.env.DATABASE_URL || '';

export const MAX_FILE_SIZE = parseInt(
  process.env.MAX_FILE_SIZE || '10485760',
  10,
);
export const MAX_DURATION = parseInt(process.env.MAX_DURATION || '0', 10);

export const USER_RATE_LIMIT = parseInt(process.env.USER_RATE_LIMIT || '0', 10);
export const USER_REQUESTS_WINDOW = parseInt(
  process.env.USER_REQUESTS_WINDOW || '0',
  10,
);

export const GLOBAL_RATE_LIMIT = parseInt(
  process.env.GLOBAL_RATE_LIMIT || '0',
  10,
);
export const GLOBAL_REQUESTS_WINDOW = parseInt(
  process.env.GLOBAL_REQUESTS_WINDOW || '0',
  10,
);

export const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID || '0', 10);
export const ADMIN_MESSAGE_THREAD_ID =
  parseInt(process.env.ADMIN_MESSAGE_THREAD_ID || '0', 10) || undefined;

export const MAX_FILE_SIZE_FORMATTED = formatBytesToString(MAX_FILE_SIZE);

export const UTC_OFFSET = parseInt(process.env.UTC_OFFSET || '0', 10);

const GLOBAL_ADMINS_VALUES = (process.env.ADMINS_IDS || '').split(',');
const GLOBAL_ADMINS = new Set<number>();
for (const userIdString of GLOBAL_ADMINS_VALUES) {
  if (!userIdString) {
    continue;
  }

  const userId = +userIdString;
  if (userId) {
    GLOBAL_ADMINS.add(userId);
  }
}

export { GLOBAL_ADMINS };
