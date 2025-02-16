import { GROQ_API_KEY, GROQ_MODEL } from '../config';

export async function transcribeAudio(
  fileUrl: string,
  filename: string,
): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio file from URL: ${fileUrl}`);
  }

  const blob = await response.blob();

  if (filename.endsWith('.oga')) {
    filename = filename.replace(/\.oga$/, '.ogg');
  }

  const formData = new FormData();
  formData.append('file', new File([blob], filename));
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
