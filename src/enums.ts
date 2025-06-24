export enum MediaType {
  AUDIO = 'audio',
  VOICE = 'voice',
  VIDEO_NOTE = 'video_note',
  VIDEO = 'video',
  PHOTO = 'photo',
  DOCUMENT = 'document',
}

export enum FormatStyle {
  PLAIN = 'plain',
  FILE = 'file',
  QUOTE = 'quote',
  EXPANDABLE_QUOTE = 'expandable_quote',
}

export enum ChatState {
  DISABLED,
  BANNED,
}

export enum Mode {
  TRANSCRIBE,
  TRANSLATE,
  IGNORE,
}
