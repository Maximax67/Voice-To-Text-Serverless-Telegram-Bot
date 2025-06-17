# Voice to Text Serverless Telegram Bot

[![GitHub License](https://img.shields.io/github/license/Maximax67/Voice-To-Text-Serverless-Telegram-Bot)](LICENSE)
[![Vercel Deploy](https://deploy-badge.vercel.app/vercel/voice-to-text-serverless-telegram-bot)](https://voice-to-text-serverless-telegram-bot.vercel.app/)
[![Telegram bot](https://img.shields.io/badge/Telegram-2CA5E0?&logo=telegram&logoColor=white&label=@voice_to_text_tg_bot)](https://t.me/voice_to_text_tg_bot)

This Telegram bot converts voice messages into text. It can be used in private chats or added to groups, where it will automatically transcribe audio messages into text. Additionally, you can use the `/transcribe` and `/translate` commands to convert any audio message into text by replying to the message. Translate mode converts audio from any language into English text only.

## Demo

Experience the bot in action on Telegram: [@voice_to_text_tg_bot](https://t.me/voice_to_text_tg_bot).

You can try it in three simple ways:

- **Private Chat**: Send any voice message directly to the bot, and it will instantly reply with the transcribed text.
- **Group Chat**: Add the bot to your group, and it will automatically convert incoming voice messages to text for everyone to read.
- **On-Demand Transcription**: Reply to any audio message with the `/transcribe` or `/translate` command to get the text version.

For the most accurate transcription and translation, it's recommended to set the chat language using the bot's settings.

## Supported languages

This bot supports transcription in **51 languages**, powered by OpenAI’s **Whisper-large-v3 model** — one of the most advanced speech recognition models available.

**Supported languages**: Afrikaans, Arabic, Armenian, Azerbaijani, Belarusian, Bosnian, Bulgarian, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, Galician, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Kannada, Kazakh, Korean, Latvian, Lithuanian, Macedonian, Malay, Marathi, Maori, Nepali, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swahili, Swedish, Tagalog, Tamil, Thai, Turkish, Ukrainian, Urdu, Vietnamese, and Welsh.

## Supported Audio Formats

The bot supports the following audio file formats: `.flac`, `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.m4a`, `.ogg`, `.oga`, `.wav`, `.webm`.

## Self-hosting

### Free limits

#### Audio Processing – Groq API

[Groq](https://groq.com/) currently provides access to the following **speech-to-text models for free**:

- `whisper-large-v3`
- `whisper-large-v3-turbo`
- `distil-whisper-large-v3-en`

Free usage limits for all models:

- 20 requests per minute
- 7,200 audio seconds per hour
- 28,800 audio seconds per day

**Note**: Only `whisper-large-v3` supports translation to English at this time.

#### Hosting and PostgreSQL database – Vercel

The bot is hosted using [Vercel](https://vercel.com/) under their **free Hobby plan**.
You can learn more about usage limits and features on the [Vercel pricing page](https://vercel.com/pricing).

#### Redis – Upstash

[Upstash](https://upstash.com/) provides a **serverless Redis database** with a generous free tier: up to **500,000 Redis commands per month**.

Full details are available on their [pricing page](https://upstash.com/pricing).

### Prerequisites

Before hosting this bot, ensure you have the following:

- A Telegram bot token (you can create one via [BotFather](https://core.telegram.org/bots#botfather)).
- A free [Groq](https://groq.com/) API key for audio transcription.
- Vercel free account for deploy.
- Upstash free account for Redis instance (rate limiting).

### Deploying to Vercel

You can fork this project and make the necessary changes you need. Once you're done with your changes, simply go to Vercel's Git import.

Reference to [this update](https://vercel.com/docs/security/deployment-protection#migrating-to-standard-protection), you need to turn off Vercel Authentication, under Settings => Deployment Protection.

### Deploying to Other Hosting Providers

You can also deploy this bot to any other hosting provider that supports Node.js, such as **Render**, **Railway**, **Fly.io**, **AWS EC2**, **DigitalOcean**, or your own VPS.

Make sure your server is accessible from the public internet and supports HTTPS (Telegram requires HTTPS for webhooks).

#### Steps for Non-Vercel Deployment

1. **Clone the repository** and install dependencies:
   ```bash
   git clone https://github.com/Maximax67/Voice-To-Text-Serverless-Telegram-Bot.git
   cd Voice-To-Text-Serverless-Telegram-Bot
   npm install
   npm build
   ```

2. **Set environment variables**  
   Create a `.env` file (see `.env.example`) and set all required variables.  
   For non-Vercel deployments, set:
   ```
   IS_VERCEL=0
   SERVER_URL=https://your-domain.com
   PORT=80
   ```
   Replace `https://your-domain.com` with your actual server's public URL.

3. **Expose the correct port**  
   Make sure your hosting provider allows incoming HTTP requests on the port you specify (default is 80).

4. **Start the bot**  
   ```bash
   npm run start
   ```
   The bot will listen for Telegram webhook events at `http://your-domain.com/api`.

5. **Set up the webhook**  
   Trigger the `/setup` route to register your webhook with Telegram:
   ```
   curl "http://your-domain.com/setup?token=your-secret-token"
   ```
   Replace `your-domain.com` and `your-secret-token` with your actual values.

### Connecting to PostgreSQL

Add connection string as `DATABASE_URL` in your environment variables.

### Steps to set up Upstash

1. Create a free account on [Upstash](https://upstash.com/).
2. Set up a Redis instance and get the `REST URL` and `Token` from Upstash.
3. In your `.env` or Vercel environment variables, add the following Upstash credentials:

   ```env
   KV_REST_API_URL=your-redis-upstash-url
   KV_REST_API_TOKEN=your-redis-upstash-token
   ```

The Redis instance is used for storing rate-limiting data for both individual users and globally, ensuring efficient control over the number of requests.

### Configuration

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

### Setting up the Telegram webhook

To set up the Telegram webhook, simply make a **single request** to the following URL:

```
https://your-app.vercel.app/api/setup?token=your-secret-token
```

Replace:
- `your-app` with your actual Vercel app name.
- `your-secret-token` with the value of your `SETUP_SECRET_TOKEN` environment variable.

**Note**: This setup only needs to be done **once** after deployment.

## Bot Commands

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

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
