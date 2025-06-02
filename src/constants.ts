import {
  MAX_DURATION,
  MAX_FILE_SIZE_FORMATTED,
  USER_RATE_LIMIT,
  USER_REQUESTS_WINDOW,
  GLOBAL_RATE_LIMIT,
  GLOBAL_REQUESTS_WINDOW,
} from './config';

export const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

const SUPPORTED_FILE_EXTENSIONS_ARRAY = [
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
];

export const SUPPORTED_FILE_EXTENSIONS = new Set(
  SUPPORTED_FILE_EXTENSIONS_ARRAY,
);

export const START_MESSAGE =
  'Hello! I am a Telegram bot for converting voice, audio, and video messages into text. Simply send them to me privately, or add me to a group, and I will automatically transcribe audio.\n\n' +
  'You can also use the following commands:\n' +
  '<b>/transcribe</b> - Transcribe the replied-to audio or video message\n' +
  '<b>/translate</b> - Translate the replied-to message to English\n' +
  '<b>/settings</b> - Open the settings menu (chat admins only)\n\n' +
  `Maximum file size: <b>${MAX_FILE_SIZE_FORMATTED}</b>\n` +
  `Maximum audio length: <b>${MAX_DURATION ? MAX_DURATION + ' seconds' : 'unlimited'}</b>\n\n` +
  '<b>Rate limits:</b>\n' +
  `Requests from one user: <b>${USER_RATE_LIMIT ? USER_RATE_LIMIT : 'unlimited'}</b>\n` +
  `User requests window: <b>${USER_REQUESTS_WINDOW ? USER_REQUESTS_WINDOW + ' seconds' : 'unlimited'}</b>\n` +
  `Global request limit: <b>${GLOBAL_RATE_LIMIT ? GLOBAL_RATE_LIMIT : 'unlimited'}</b>\n` +
  `Global requests window: <b>${GLOBAL_REQUESTS_WINDOW ? GLOBAL_REQUESTS_WINDOW + ' seconds' : 'unlimited'}</b>\n\n` +
  '<b>Supported file types:</b>\n' +
  SUPPORTED_FILE_EXTENSIONS_ARRAY.join(', ');

export const INVALID_USAGE_ERROR =
  'Please reply to voice, audio or video message!';

export const INVALID_MESSAGE_TYPE_ERROR =
  'Only voice, audio and video messages are supported!';

export const NON_ADMINS_ACCESS_SETTINGS_ERROR =
  'Only admins can access settings in group chats!';

export const LANGUAGE_CODES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  hy: 'Armenian',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bs: 'Bosnian',
  bg: 'Bulgarian',
  ca: 'Catalan',
  zh: 'Chinese',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  gl: 'Galician',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  ko: 'Korean',
  lv: 'Latvian',
  lt: 'Lithuanian',
  mk: 'Macedonian',
  ms: 'Malay',
  mr: 'Marathi',
  mi: 'Maori',
  ne: 'Nepali',
  no: 'Norwegian',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sr: 'Serbian',
  sk: 'Slovak',
  sl: 'Slovenian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog',
  ta: 'Tamil',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  cy: 'Welsh',
};
