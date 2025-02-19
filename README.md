# Voice to Text Serverless Telegram Bot

This Telegram bot converts voice messages into text. It can be used in private chats or added to groups, where it will automatically transcribe audio messages into text. Additionally, you can use the `/transcribe` command to convert any audio message into text by replying to the message.

## Prerequisites

Before running this bot, ensure you have the following:

- A Telegram bot token (you can create one via [BotFather](https://core.telegram.org/bots#botfather))
- A GROQ API key for audio transcription
- Vercel free account for deploy
- Upstash free account for Redis instance (for rate limiting)

## Production

You can fork this project and make the necessary changes you need. Once you're done with your changes, simply go to Vercel's Git import.

Reference to this update, you need to turn off Vercel Authentication, under Settings => Deployment Protection.

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
- **GROQ_API_KEY**: The key you get from [GROQ](https://groq.com/), which will be used to transcribe the audio files.
- **GROQ_MODEL**: The transcription model to use. Available models include:

  - `whisper-large-v3`
  - `whisper-large-v3-turbo`
  - `distil-whisper-large-v3-en`

- **MAX_FILE_SIZE**: Maximum allowed file size for audio files. Default is 10 MB.
- **MAX_DURATION**: Maximum duration for the audio. Default is 5 minutes (300 seconds).
- **USER_RATE_LIMIT**: Maximum number of requests per user within the time window. Default is 5 requests.
- **USER_REQUESTS_WINDOW**: Time window for limiting requests from a single user. Default is 60 seconds.
- **GLOBAL_RATE_LIMIT**: Maximum number of requests from all users within the time window. Default is 60 requests.
- **GLOBAL_REQUESTS_WINDOW**: Time window for global rate limiting. Default is 1 hour (3600 seconds).
- **ADMIN_CHAT_ID**: Admin chat id for logs. Logging disabled if not set or set to 0.
- **ADMIN_MESSAGE_THREAD_ID**: Admin thread id for logs (if supergroup).
- **SKIP_LOGGING_FOR_CHATS**: List of chat IDs for which logging should be skipped. Logging is always disabled for `ADMIN_CHAT_ID`.
- **SKIP_LOGGING_FOR_USERS**: List of user IDs for which logging should be skipped.

## Commands

- **/start**: Provides a welcome message and lists bot usage limits.
- **/transcribe**: Responds to a voice message to convert it into text. Simply reply to an audio message.

## Supported Audio Formats

The bot supports the following audio file formats: `.flac`, `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.m4a`, `.ogg`, `.oga`, `.wav`, `.webm`

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
