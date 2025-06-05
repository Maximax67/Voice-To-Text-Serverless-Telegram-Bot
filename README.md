# Voice to Text Serverless Telegram Bot

[![GitHub License](https://img.shields.io/github/license/Maximax67/Voice-To-Text-Serverless-Telegram-Bot)](LICENSE)
[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/voice-to-text-serverless-telegram-bot)](https://voice-to-text-serverless-telegram-bot.vercel.app/)
[![Telegram bot](https://img.shields.io/badge/Telegram-2CA5E0?&logo=telegram&logoColor=white&label=@voice_to_text_tg_bot)](https://t.me/voice_to_text_tg_bot)

This Telegram bot converts voice messages into text. It can be used in private chats or added to groups, where it will automatically transcribe audio messages into text. Additionally, you can use the `/transcribe` command to convert any audio message into text by replying to the message.

## Prerequisites

Before running this bot, ensure you have the following:

- A Telegram bot token (you can create one via [BotFather](https://core.telegram.org/bots#botfather)).
- A GROQ API key for audio transcription.
- Vercel free account for deploy.
- Upstash free account for Redis instance (for rate limiting).

## Production

You can fork this project and make the necessary changes you need. Once you're done with your changes, simply go to Vercel's Git import.

Reference to [this update](https://vercel.com/docs/security/deployment-protection#migrating-to-standard-protection), you need to turn off Vercel Authentication, under Settings => Deployment Protection.

To set up the Telegram webhook, make a request to: `https://your-app.vercel.app/api/setup?token=your-secret-token` where `your-secret-token` corresponds to the `SETUP_SECRET_TOKEN` environment variable.

## Connecting to Vercel PostgreSQL

To use PostgreSQL with your bot via Vercel Postgres:

1. Go to Vercel Postgres and create a new database.
2. Once created, copy the connection string (e.g., `postgres://username:password@host:port/database`).
3. Add it as `DATABASE_URL` in your environment variables.

## Upstash Redis for Rate Limiting

To implement rate limiting for both individual users and globally across all users, this bot uses Upstash, a serverless Redis solution.

### Steps to set up Upstash with Vercel

1. Create a free account on [Upstash](https://upstash.com/).
2. Set up a Redis instance and get the `REST URL` and `Token` from Upstash.
3. In your `.env` or Vercel environment variables, add the following Upstash credentials:

   ```env
   KV_REST_API_URL=your-redis-upstash-url
   KV_REST_API_TOKEN=your-redis-upstash-token
   ```

The Redis instance is used for storing rate-limiting data for both individual users and globally, ensuring efficient control over the number of requests.

## Configuration

Set up the `.env` file according to `.env.example` or directly configure these values in Vercel's environment variables:

- **BOT_TOKEN**: The token provided by BotFather when creating your bot.
- **GROQ_API_KEY**: The key you get from [Groq](https://groq.com/), which will be used to transcribe the audio files.
- **GROQ_MODEL**: The transcription model to use. Available models include:

  - `whisper-large-v3`
  - `whisper-large-v3-turbo`
  - `distil-whisper-large-v3-en`

- **GROQ_TRANSLATE_MODEL**: The translation model to use. Currently [Groq](https://groq.com/) supports only `whisper-large-v3` for translation.
- **MAX_FILE_SIZE**: Maximum allowed file size for audio files. Default is 10 MB.
- **MAX_DURATION**: Maximum duration for the audio. Default is 5 minutes (300 seconds).
- **USER_RATE_LIMIT**: Maximum number of requests per user within the time window. Default is 5 requests.
- **USER_REQUESTS_WINDOW**: Time window for limiting requests from a single user. Default is 60 seconds.
- **GLOBAL_RATE_LIMIT**: Maximum number of requests from all users within the time window. Default is 60 requests.
- **GLOBAL_REQUESTS_WINDOW**: Time window for global rate limiting. Default is 1 hour (3600 seconds).
- **ADMIN_CHAT_ID**: Admin chat id for logs. Logging disabled if not set or set to 0.
- **ADMIN_MESSAGE_THREAD_ID**: Admin thread id for logs (if supergroup).
- **ADMINS_IDS**: List of admins separated by comma ids for ban, unban, logs, chat list and statistics features.
- **UTC_OFFSET**: Sets the time difference from UTC in hours. Use a positive number for time zones ahead of UTC (e.g. `2` for UTC+2), and a negative number for those behind (e.g. `-5` for UTC-5).
- **SETUP_SECRET_TOKEN**: A secret token used to secure an HTTP route /api/setup that sets the webhook when accessed with this token. After deployment, you can trigger the webhook setup by hitting:

  ```bash
  curl "https://your-app.vercel.app/api/setup?token=your-secret-token"
  ```

- **TELEGRAM_SECRET_TOKEN**: A secret token to protect your Telegram webhook from unauthorized requests. It ensures that only Telegram can send updates to your bot, adding an extra layer of security.

## Commands

### Public Commands

- **`/start`** – Displays a welcome message and lists the bot usage limits.
- **`/transcribe`** – Transcribes a voice message to text. Use by replying to an audio message.
- **`/translate`** – Translates the replied-to message into English.
- **`/settings`** – Opens the settings menu (available to chat admins only).
- **`/stats`** – Shows statistics for the current chat.

### Admin-Only Commands (`ADMINS_IDS` environment variable)

- **`/ban {chatId}`** – Bans the specified chat.
- **`/unban {chatId}`** – Unbans the specified chat.
- **`/ban_list`** – Lists all banned chats.
- **`/disable_logging {chatId}`** – Disables logging for the specified chat.
- **`/enable_logging {chatId}`** – Enables logging for the specified chat.
- **`/logs [chatId]`** – Retrieves request logs in CSV format for the specified chat, or for all chats if no `chatId` is provided.
- **`/logs_json [chatId]`** – Retrieves request logs in JSON format for the specified chat, or for all chats if no `chatId` is provided.
- **`/delete_logs {chatId}`** – Deletes all logs for the specified chat.
- **`/delete_all_logs`** – Deletes all logs for all chats.
- **`/chat_list`** – Retrieves a list of chats where the bot has been used sorted by last usage time.
- **`/chat_list_by_requests`** – Retrieves a list of chats where the bot has been used sorted by usage count.
- **`/stats {chatId}`** – Retrieves statistics for the specified chat.
- **`/global_stats`** – Retrieves global usage statistics.

## Supported Audio Formats

The bot supports the following audio file formats: `.flac`, `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.m4a`, `.ogg`, `.oga`, `.wav`, `.webm`

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
