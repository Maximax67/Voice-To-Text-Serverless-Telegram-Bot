import { checkFileExtension } from './check_file_extension';
import { transcribeAudio } from './transcribe_audio';
import { sendTranscription } from './send_transcription';
import type { Context } from 'telegraf';

export async function processVoiceMessage(
  fileUrl: string,
  filename: string,
  ctx: Context,
) {
  if (!checkFileExtension(filename)) {
    await ctx.reply('Audio format not supported');
    return;
  }

  const transcription = await transcribeAudio(fileUrl, filename);

  if (!transcription || transcription.trim() === '') {
    await ctx.reply('Unable to get transcription');
    return;
  }

  await sendTranscription(transcription, ctx);
}
