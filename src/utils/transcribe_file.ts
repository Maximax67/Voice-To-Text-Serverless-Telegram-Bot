import { GROQ_API_KEY, GROQ_MODEL, GROQ_TRANSLATE_MODEL } from '../config';
import { Mode } from '../enums';
import { retryOnException } from './retry_on_exception';

export async function processFile(
  file: File,
  mode: Mode = Mode.TRANSCRIBE,
  language: string | null,
  retries = 3,
  retryDelay = 1000,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  let url: string;
  if (mode === Mode.TRANSCRIBE) {
    formData.append('model', GROQ_MODEL);
    if (language) {
      formData.append('language', language);
    }

    url = 'https://api.groq.com/openai/v1/audio/transcriptions';
  } else {
    formData.append('model', GROQ_TRANSLATE_MODEL);
    url = 'https://api.groq.com/openai/v1/audio/translations';
  }

  const groqResponse = await retryOnException(
    () =>
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      }),
    retries,
    retryDelay,
  );

  if (!groqResponse.ok) {
    throw new Error(
      `Groq API error: ${groqResponse.status} ${groqResponse.statusText}`,
    );
  }

  const transcription = await groqResponse.json();

  return transcription.text.trim();
}
