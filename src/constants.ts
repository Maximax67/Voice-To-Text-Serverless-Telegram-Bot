import {
  MAX_DURATION,
  MAX_FILE_SIZE_FORMATTED,
  USER_RATE_LIMIT,
  USER_REQUEST_WINDOW,
  GLOBAL_RATE_LIMIT,
  GLOBAL_REQUEST_WINDOW,
} from './config';

export const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;
export const SUPPORTED_FILE_EXTENSIONS = new Set([
  'flac',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'm4a',
  'ogg',
  'oga',
  'wav',
  'webm',
]);

export const START_MESSAGE =
  "Hello! I am a Telegram bot for converting voice, audio and video messages into text. Simply send them to me privately, or add me to a group, and I will automatically transcribe audio. You can also use the /transcribe command by replying to any message you'd like me to transcribe.\n\n" +
  '<b>Limits:</b>\n' +
  `Maximum file size: <b>${MAX_FILE_SIZE_FORMATTED}</b>\n` +
  `Maximum audio length: <b>${MAX_DURATION ? MAX_DURATION + ' seconds' : 'unlimited'}</b>\n\n` +
  `Requests from one user: <b>${USER_RATE_LIMIT ? USER_RATE_LIMIT : 'unlimited'}</b>\n` +
  `Time window for user requests: <b>${USER_REQUEST_WINDOW ? USER_REQUEST_WINDOW + ' seconds' : 'unlimited'}</b>\n` +
  `Global request limit: <b>${GLOBAL_RATE_LIMIT ? GLOBAL_RATE_LIMIT : 'unlimited'}</b>\n` +
  `Time window for global requests: <b>${GLOBAL_REQUEST_WINDOW ? GLOBAL_REQUEST_WINDOW + ' seconds' : 'unlimited'}</b>\n\n`;
