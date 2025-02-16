import { GROQ_API_KEY, GROQ_MODEL } from '../config';

export async function transcribeFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', GROQ_MODEL);

  const groqResponse = await fetch(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    },
  );

  if (!groqResponse.ok) {
    throw new Error(
      `Groq API error: ${groqResponse.status} ${groqResponse.statusText}`,
    );
  }

  const transcription = await groqResponse.json();

  return transcription.text;
}
