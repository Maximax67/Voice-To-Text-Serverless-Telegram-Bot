import { Client } from 'pg';
import { DATABASE_URL } from '../config';
import { LANGUAGE_CODES } from '../constants';
import { FormatStyle, MediaType } from '../enums';

let client: Client | null = null;

export async function getClient(): Promise<Client> {
  if (!client) {
    client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    await client.connect();
  }

  return client;
}

export async function setupDatabase() {
  const quotedLangs = Object.keys(LANGUAGE_CODES)
    .map((code) => `'${code}'`)
    .join(', ');

  const quotedMediaTypes = Object.values(MediaType)
    .map((type) => `'${type}'`)
    .join(', ');

  const quotedFormatStyles = Object.values(FormatStyle)
    .map((style) => `'${style}'`)
    .join(', ');

  const client = await getClient();

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language_enum') THEN
        CREATE TYPE language_enum AS ENUM (${quotedLangs});
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'format_style_enum') THEN
        CREATE TYPE format_style_enum AS ENUM (${quotedFormatStyles});
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type_enum') THEN
        CREATE TYPE media_type_enum AS ENUM (${quotedMediaTypes});
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS chats (
      chat_id BIGINT PRIMARY KEY,
      language language_enum,
      format_style format_style_enum NOT NULL,
      default_mode SMALLINT NOT NULL,
      banned_timestamp TIMESTAMP,
      logging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      edited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_requests (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      forward_chat_id BIGINT,
      is_forward BOOLEAN NOT NULL DEFAULT FALSE,
      chat_id BIGINT NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
      mode SMALLINT NOT NULL,
      message_id INT NOT NULL,
      media_type media_type_enum NOT NULL,
      logged_message_id INT,
      file_id TEXT NOT NULL,
      file_type TEXT,
      file_size INT NOT NULL,
      duration INT,
      response TEXT,
      error TEXT,
      language language_enum,
      media_download_time INT,
      api_request_time INT,
      total_request_time INT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_media_requests_user_id ON media_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_requests_chat_id ON media_requests(chat_id);
  `);
}
