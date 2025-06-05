import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_API_BASE = (token: string) =>
  `https://api.telegram.org/bot${token}`;

async function deleteWebhook(botToken: string) {
  const res = await fetch(`${TELEGRAM_API_BASE(botToken)}/deleteWebhook`);
  if (!res.ok) {
    throw new Error(`Failed to delete webhook: ${await res.text()}`);
  }
}

async function setWebhook(botToken: string, url: string, secretToken?: string) {
  const params: Record<string, string> = {
    url,
    allowed_updates: JSON.stringify([
      'message',
      'callback_query',
      'my_chat_member',
    ]),
  };

  if (secretToken) {
    params.secret_token = secretToken;
  }

  const searchParams = new URLSearchParams(params);
  const res = await fetch(
    `${TELEGRAM_API_BASE(botToken)}/setWebhook?${searchParams.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to set webhook: ${await res.text()}`);
  }
}

export default async function handle(req: VercelRequest, res: VercelResponse) {
  const VERCEL_URL = process.env.VERCEL_URL;
  if (!VERCEL_URL) {
    return res.status(500).json({ error: 'VERCEL_URL is not set' });
  }

  const SETUP_SECRET_TOKEN = process.env.SETUP_SECRET_TOKEN;
  if (SETUP_SECRET_TOKEN && req.query.token !== SETUP_SECRET_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const botToken = process.env.BOT_TOKEN!;
    const webhookUrl = `${VERCEL_URL}/api`;
    const secretToken = process.env.TELEGRAM_SECRET_TOKEN;

    await deleteWebhook(botToken);
    await setWebhook(botToken, webhookUrl, secretToken);

    res.status(200).json({ status: 'Webhook is set successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
}
