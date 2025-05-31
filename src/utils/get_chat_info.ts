import type { Client } from 'pg';
import type { ChatInfo } from '../types';
import { FormatStyle, Mode } from '../enums';
import { setupDatabase } from '../core';

let isDbInitialized = false;

export async function getChatInfo(
  client: Client,
  chat_id: number,
): Promise<ChatInfo> {
  try {
    const result = await client.query<ChatInfo>(
      `SELECT * FROM tg_chats WHERE chat_id = $1;`,
      [chat_id],
    );

    isDbInitialized = true;

    if (result.rowCount) {
      return result.rows[0];
    }

    const insertResult = await client.query<ChatInfo>(
      `INSERT INTO tg_chats (chat_id, format_style, default_mode)
      VALUES ($1, $2, $3)
      RETURNING *;`,
      [chat_id, FormatStyle.PLAIN, Mode.TRANSCRIBE],
    );

    return insertResult.rows[0];
  } catch (error: any) {
    // 42P01 = undefined_table
    // 42704 = undefined_object (can be enum types)
    if (
      !isDbInitialized &&
      (error.code === '42P01' || error.code === '42704')
    ) {
      isDbInitialized = true;
      await setupDatabase();
      return getChatInfo(client, chat_id);
    }
    throw error;
  }
}
