import { FormatStyle, Mode } from '../enums';
import { setupDatabase } from '../core';

import type { Client } from 'pg';
import type { Context } from 'telegraf';
import type { ChatInfo } from '../types';

let isDbInitialized = false;

export async function getChatInfo(
  client: Client,
  chatId: number,
): Promise<ChatInfo> {
  try {
    const result = await client.query<ChatInfo>(
      `SELECT * FROM chats WHERE chat_id = $1;`,
      [chatId],
    );

    isDbInitialized = true;

    if (result.rowCount) {
      return result.rows[0];
    }

    const insertResult = await client.query<ChatInfo>(
      `INSERT INTO chats (chat_id, format_style, default_mode)
      VALUES ($1, $2, $3)
      RETURNING *;`,
      [chatId, FormatStyle.PLAIN, Mode.TRANSCRIBE],
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
      return getChatInfo(client, chatId);
    }
    throw error;
  }
}

export async function ensureChatRecord(
  client: Client,
  chatId: number,
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO chats (chat_id, format_style, default_mode)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id) DO NOTHING;`,
      [chatId, FormatStyle.PLAIN, Mode.TRANSCRIBE],
    );
  } catch (error: any) {
    // 42P01 = undefined_table
    // 42704 = undefined_object (can be enum types)
    if (
      !isDbInitialized &&
      (error.code === '42P01' || error.code === '42704')
    ) {
      isDbInitialized = true;
      await setupDatabase();
      await getChatInfo(client, chatId);
      return;
    }

    throw error;
  }
}

export async function getChatName(
  ctx: Context,
  chatId: number,
): Promise<string | null> {
  try {
    const chat = await ctx.telegram.getChat(chatId);
    if (chat.type === 'private') {
      if (chat.username) {
        return `@${chat.username}`;
      }

      if (chat.last_name) {
        return `${chat.first_name} ${chat.last_name}`;
      }

      return chat.first_name;
    }

    return chat.title;
  } catch {}

  return null;
}
