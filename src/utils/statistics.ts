import { getClient } from '../core';
import { escapeHTML } from './escape_html';
import { formatBytesToString } from './format_bytes_to_string';
import { formatDateTime } from './format_datetime';
import { getChatName } from './get_chat_info';
import { getChatIdFromCommand } from './get_chat_id_from_command';
import { isGlobalAdmin } from './is_admin';
import { LANGUAGE_CODES, MAX_TELEGRAM_MESSAGE_LENGTH } from '../constants';
import { Mode } from '../enums';

import type { Context } from 'telegraf';
import type { ChatInfo } from '../types';

export async function chatList(
  ctx: Context,
  orderByUsageCount: boolean = false,
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isGlobalAdmin(userId)) return;

  const orderByRule = orderByUsageCount
    ? 'usage_count DESC'
    : 'last_usage DESC NULLS LAST';

  const client = await getClient();
  const res = await client.query(`
    SELECT
      c.chat_id,
      c.banned_timestamp,
      c.logging_enabled,
      c.created_at,
      MAX(r.timestamp) AS last_usage,
      COUNT(r.id) AS usage_count
    FROM chats c
    LEFT JOIN media_requests r ON c.chat_id = r.chat_id
    GROUP BY c.chat_id, c.banned_timestamp, c.logging_enabled, c.created_at
    ORDER BY ${orderByRule}, c.created_at DESC;
  `);

  if (res.rowCount === 0) {
    await ctx.reply('No chats found!');
    return;
  }

  const lines = await Promise.all(
    res.rows.map(async (row) => {
      const loggingIcon = row.logging_enabled ? '📝' : '🔏';
      const lastUsage = row.last_usage
        ? formatDateTime(row.last_usage)
        : 'never';
      const createdAt = formatDateTime(row.created_at);
      const bannedIcon = row.banned_timestamp ? '🚫' : '✔️';
      const chatName = await getChatName(ctx, row.chat_id);

      let result = `${bannedIcon} ${loggingIcon} <code>`;
      if (chatName) {
        result += `${escapeHTML(chatName)}</code>\nId: <code>${row.chat_id}</code>\n`;
      } else {
        result += `${row.chat_id}</code>\n`;
      }

      return (
        result +
        `Requests: ${row.usage_count}\n` +
        `Last usage: ${lastUsage}\n` +
        `Joined on: ${createdAt}\n`
      );
    }),
  );

  const messages: string[] = [];
  let currentMessage = '';

  for (const line of lines) {
    const joinedMessage = currentMessage + '\n' + line;
    if (joinedMessage.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
      messages.push(currentMessage);
      currentMessage = line;
    } else {
      currentMessage = joinedMessage;
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  for (const message of messages) {
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
}

export async function showChatStatistics(ctx: Context): Promise<void> {
  const isAdmin = isGlobalAdmin(ctx.from!.id);
  const chatId = isAdmin
    ? (getChatIdFromCommand(ctx) ?? ctx.chat!.id)
    : ctx.chat!.id;

  const client = await getClient();
  const chatInfoResult = await client.query<ChatInfo>(
    'SELECT * FROM chats WHERE chat_id = $1;',
    [chatId],
  );

  if (!chatInfoResult.rowCount) {
    await ctx.reply('Chat not found!');
    return;
  }

  const chatInfo = chatInfoResult.rows[0];
  const reqRes = await client.query<{
    usage_count: string;
    first_usage: Date | null;
    last_usage: Date | null;
    users_count: string;
    error_count: string;
    avg_duration: string | null;
    avg_file_size: string | null;
    mode_transcribe: string;
    mode_translate: string;
    media_audio: string;
    media_voice: string;
    media_video: string;
    media_video_note: string;
    forwarded_count: string;
    avg_response_length: string | null;
    avg_total_request_time: string | null;
  }>(
    `
    SELECT
      COUNT(*) AS usage_count,
      MIN(timestamp) AS first_usage,
      MAX(timestamp) AS last_usage,
      COUNT(DISTINCT user_id) AS users_count,
      COUNT(*) FILTER (WHERE error IS NOT NULL AND error <> '') AS error_count,
      AVG(duration) AS avg_duration,
      AVG(file_size) AS avg_file_size,
      COUNT(*) FILTER (WHERE mode = 0) AS mode_transcribe,
      COUNT(*) FILTER (WHERE mode = 1) AS mode_translate,
      COUNT(*) FILTER (WHERE media_type = 'audio') AS media_audio,
      COUNT(*) FILTER (WHERE media_type = 'voice') AS media_voice,
      COUNT(*) FILTER (WHERE media_type = 'video') AS media_video,
      COUNT(*) FILTER (WHERE media_type = 'video_note') AS media_video_note,
      COUNT(*) FILTER (WHERE is_forward = TRUE) AS forwarded_count,
      AVG(LENGTH(response)) AS avg_response_length,
      AVG(total_request_time) AS avg_total_request_time
    FROM media_requests
    WHERE chat_id = $1
  `,
    [chatId],
  );

  const stats = reqRes.rows[0];

  let avgPerDay = 'n/a';
  const usageCountNumber = +stats.usage_count;
  if (stats.first_usage && stats.last_usage && usageCountNumber > 0) {
    const first = new Date(stats.first_usage);
    const last = new Date(stats.last_usage);
    const days = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    avgPerDay = (usageCountNumber / days).toFixed(2);
  }

  const chatName = await getChatName(ctx, chatId);

  const lines = [
    '📊 <b>Statistics for chat:</b> ' +
      (chatName
        ? `<code>${escapeHTML(chatName)}</code> (<code>${chatId}</code>)`
        : `<code>${chatId}</code>`),
    '',
    `<b>Total requests:</b> ${stats.usage_count}`,
    `<b>Unique users:</b> ${stats.users_count}`,
    `<b>First usage:</b> ${stats.first_usage ? formatDateTime(stats.first_usage) : 'never'}`,
    `<b>Last usage:</b> ${stats.last_usage ? formatDateTime(stats.last_usage) : 'never'}`,
    `<b>Average requests per day:</b> ${avgPerDay}`,
    `<b>Errors:</b> ${stats.error_count}`,
    `<b>Forwarded messages:</b> ${stats.forwarded_count}`,
    '',
    `<b>By mode:</b>`,
    `- Transcribe: ${stats.mode_transcribe}`,
    `- Translate: ${stats.mode_translate}`,
    '',
    `<b>By media type:</b>`,
    `- Audio: ${stats.media_audio}`,
    `- Voice: ${stats.media_voice}`,
    `- Video: ${stats.media_video}`,
    `- Video Note: ${stats.media_video_note}`,
    '',
    `<b>Average duration:</b> ${stats.avg_duration ? Number(stats.avg_duration).toFixed(2) + ' sec' : 'n/a'}`,
    `<b>Average file size:</b> ${stats.avg_file_size ? formatBytesToString(Number(stats.avg_file_size)) : 'n/a'}`,
    `<b>Average response length:</b> ${stats.avg_response_length ? Number(stats.avg_response_length).toFixed(1) + ' chars' : 'n/a'}`,
    `<b>Average request time:</b> ${stats.avg_total_request_time ? Number(stats.avg_total_request_time).toFixed(1) + ' ms' : 'n/a'}`,
    '',
    `<b>Chat settings:</b>`,
    `- Language: ${chatInfo.language ? LANGUAGE_CODES[chatInfo.language] : 'not set'}`,
    `- Format style: ${chatInfo.format_style}`,
    `- Default mode: ${chatInfo.default_mode === null ? 'not set' : chatInfo.default_mode === 0 ? 'Transcribe' : 'Translate'}`,
    `- Banned: ${chatInfo.banned_timestamp ? `<b>yes</b>, ${formatDateTime(chatInfo.banned_timestamp)}` : 'no'}`,
    `- Created: ${formatDateTime(chatInfo.created_at)}`,
    `- Last edited: ${formatDateTime(chatInfo.edited_at)}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

export async function showGlobalStatistics(ctx: Context): Promise<void> {
  if (!isGlobalAdmin(ctx.from!.id)) {
    return;
  }

  const client = await getClient();
  const reqRes = await client.query<{
    usage_count: string;
    first_usage: Date | null;
    last_usage: Date | null;
    users_count: string;
    chats_count: string;
    error_count: string;
    avg_duration: string | null;
    avg_file_size: string | null;
    mode_transcribe: string;
    mode_translate: string;
    media_audio: string;
    media_voice: string;
    media_video: string;
    media_video_note: string;
    forwarded_count: string;
    avg_response_length: string | null;
    avg_total_request_time: string | null;
    max_duration: string | null;
    min_duration: string | null;
    max_file_size: string | null;
    min_file_size: string | null;
    max_response_length: string | null;
    min_response_length: string | null;
    max_total_request_time: string | null;
    min_total_request_time: string | null;
  }>(`
    SELECT
      COUNT(*) AS usage_count,
      MIN(timestamp) AS first_usage,
      MAX(timestamp) AS last_usage,
      COUNT(DISTINCT user_id) AS users_count,
      COUNT(DISTINCT chat_id) AS chats_count,
      COUNT(*) FILTER (WHERE error IS NOT NULL AND error <> '') AS error_count,
      AVG(duration) AS avg_duration,
      MAX(duration) AS max_duration,
      MIN(duration) AS min_duration,
      AVG(file_size) AS avg_file_size,
      MAX(file_size) AS max_file_size,
      MIN(file_size) AS min_file_size,
      COUNT(*) FILTER (WHERE mode = 0) AS mode_transcribe,
      COUNT(*) FILTER (WHERE mode = 1) AS mode_translate,
      COUNT(*) FILTER (WHERE media_type = 'audio') AS media_audio,
      COUNT(*) FILTER (WHERE media_type = 'voice') AS media_voice,
      COUNT(*) FILTER (WHERE media_type = 'video') AS media_video,
      COUNT(*) FILTER (WHERE media_type = 'video_note') AS media_video_note,
      COUNT(*) FILTER (WHERE is_forward = TRUE) AS forwarded_count,
      AVG(LENGTH(response)) AS avg_response_length,
      MAX(LENGTH(response)) AS max_response_length,
      MIN(LENGTH(response)) AS min_response_length,
      AVG(total_request_time) AS avg_total_request_time,
      MAX(total_request_time) AS max_total_request_time,
      MIN(total_request_time) AS min_total_request_time
    FROM media_requests
  `);

  const stats = reqRes.rows[0];

  const chatAggRes = await client.query<{
    chats_count: string;
    languages: { language: string; count: string }[];
    format_styles: { format_style: string; count: string }[];
    banned_count: string;
    logging_enabled_count: string;
    default_mode_transcribe: string;
    default_mode_translate: string;
    private_count: string;
    supergroup_count: string;
  }>(`
    SELECT
      COUNT(*) as chats_count,
      ARRAY(
        SELECT jsonb_build_object('language', language, 'count', COUNT(*))
        FROM chats
        GROUP BY language
        ORDER BY COUNT(*) DESC
      ) AS languages,
      ARRAY(
        SELECT jsonb_build_object('format_style', format_style, 'count', COUNT(*))
        FROM chats
        GROUP BY format_style
        ORDER BY COUNT(*) DESC
      ) AS format_styles,
      COUNT(*) FILTER (WHERE banned_timestamp IS NOT NULL)::text AS banned_count,
      COUNT(*) FILTER (WHERE logging_enabled IS TRUE)::text AS logging_enabled_count,
      COUNT(*) FILTER (WHERE default_mode = ${Mode.TRANSCRIBE})::text AS default_mode_transcribe,
      COUNT(*) FILTER (WHERE default_mode = ${Mode.TRANSLATE})::text AS default_mode_translate,
      COUNT(*) FILTER (WHERE chat_id > 0)::text AS private_count,
      COUNT(*) FILTER (WHERE chat_id <= -1000000000000)::text AS supergroup_count
    FROM chats
  `);

  const chatAgg = chatAggRes.rows[0];

  let avgPerDay = 'n/a';
  const usageCountNumber = +stats.usage_count;
  if (stats.first_usage && stats.last_usage && usageCountNumber > 0) {
    const first = new Date(stats.first_usage);
    const last = new Date(stats.last_usage);
    const days = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    avgPerDay = (usageCountNumber / days).toFixed(2);
  }

  const langLines =
    Array.isArray(chatAgg.languages) && chatAgg.languages.length
      ? chatAgg.languages.map(
          (row) =>
            `- ${LANGUAGE_CODES[row.language] || row.language || 'Multilingual'}: ${row.count}`,
        )
      : ['- none'];

  const formatLines =
    Array.isArray(chatAgg.format_styles) && chatAgg.format_styles.length
      ? chatAgg.format_styles.map(
          (row) =>
            `- ${row.format_style[0].toUpperCase()}${row.format_style.slice(1).replace('_', ' ')}: ${row.count}`,
        )
      : ['- none'];

  const chatCount = +chatAgg.chats_count;
  const loggingDisabled = chatCount - Number(chatAgg.logging_enabled_count);
  const groupCount =
    chatCount -
    Number(chatAgg.private_count) -
    Number(chatAgg.supergroup_count);
  const defaultModeDisabled =
    chatCount -
    Number(chatAgg.default_mode_transcribe) -
    Number(chatAgg.default_mode_translate);

  const lines = [
    '🌐 <b>Global Statistics</b>',
    '',
    `<b>Total requests:</b> ${stats.usage_count}`,
    `<b>Unique users:</b> ${stats.users_count}`,
    `<b>First usage:</b> ${stats.first_usage ? formatDateTime(stats.first_usage) : 'never'}`,
    `<b>Last usage:</b> ${stats.last_usage ? formatDateTime(stats.last_usage) : 'never'}`,
    `<b>Average requests per day:</b> ${avgPerDay}`,
    `<b>Errors:</b> ${stats.error_count}`,
    `<b>Forwarded messages:</b> ${stats.forwarded_count}`,
    '',
    `<b>By mode:</b>`,
    `- Transcribe: ${stats.mode_transcribe}`,
    `- Translate: ${stats.mode_translate}`,
    '',
    `<b>By media type:</b>`,
    `- Audio: ${stats.media_audio}`,
    `- Voice: ${stats.media_voice}`,
    `- Video: ${stats.media_video}`,
    `- Video Note: ${stats.media_video_note}`,
    '',
    `<b>Average duration:</b> ${stats.avg_duration ? Number(stats.avg_duration).toFixed(2) + ' sec' : 'n/a'}`,
    `<b>Max duration:</b> ${stats.max_duration ? Number(stats.max_duration).toFixed(2) + ' sec' : 'n/a'}`,
    `<b>Min duration:</b> ${stats.min_duration ? Number(stats.min_duration).toFixed(2) + ' sec' : 'n/a'}`,
    '',
    `<b>Average file size:</b> ${stats.avg_file_size ? formatBytesToString(Number(stats.avg_file_size)) : 'n/a'}`,
    `<b>Max file size:</b> ${stats.max_file_size ? formatBytesToString(Number(stats.max_file_size)) : 'n/a'}`,
    `<b>Min file size:</b> ${stats.min_file_size ? formatBytesToString(Number(stats.min_file_size)) : 'n/a'}`,
    '',
    `<b>Average response length:</b> ${stats.avg_response_length ? Number(stats.avg_response_length).toFixed(1) + ' chars' : 'n/a'}`,
    `<b>Max response length:</b> ${stats.max_response_length ? stats.max_response_length + ' chars' : 'n/a'}`,
    `<b>Min response length:</b> ${stats.min_response_length ? stats.min_response_length + ' chars' : 'n/a'}`,
    '',
    `<b>Average request time:</b> ${stats.avg_total_request_time ? Number(stats.avg_total_request_time).toFixed(1) + ' ms' : 'n/a'}`,
    `<b>Max request time:</b> ${stats.max_total_request_time ? stats.max_total_request_time + ' ms' : 'n/a'}`,
    `<b>Min request time:</b> ${stats.min_total_request_time ? stats.min_total_request_time + ' ms' : 'n/a'}`,
    '',
    `<b>Chats:</b>`,
    `- Total: ${chatAgg.chats_count}`,
    `- With requests: ${stats.chats_count}`,
    `- Banned: ${chatAgg.banned_count}`,
    '',
    '<b>Chat Types:</b>',
    `- Private chats: ${chatAgg.private_count}`,
    `- Groups: ${groupCount}`,
    `- Supergroups: ${chatAgg.supergroup_count}`,
    '',
    `<b>Logging:</b>`,
    `- Enabled: ${chatAgg.logging_enabled_count}`,
    `- Disabled: ${loggingDisabled}`,
    '',
    `<b>Languages:</b>`,
    ...langLines,
    '',
    `<b>Format styles:</b>`,
    ...formatLines,
    '',
    `<b>Default mode:</b>`,
    `- Transcribe: ${chatAgg.default_mode_transcribe}`,
    `- Translate: ${chatAgg.default_mode_translate}`,
    `- Disabled: ${defaultModeDisabled}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}
