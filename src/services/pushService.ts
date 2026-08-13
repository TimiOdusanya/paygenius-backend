import DeviceToken from '../models/DeviceToken';
import logger from '../lib/log/winston.log';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken');
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const expoTokens = tokens.filter(isExpoPushToken);
  if (expoTokens.length === 0) return;

  try {
    const messages = expoTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Expo push request failed', { status: response.status, text });
      return;
    }

    const payload = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = payload.data ?? [];

    const staleTokens = tickets
      .map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? expoTokens[index]
          : null
      )
      .filter((token): token is string => Boolean(token));

    if (staleTokens.length > 0) {
      await DeviceToken.deleteMany({ token: { $in: staleTokens } });
      logger.info('Removed unregistered Expo device tokens', { count: staleTokens.length });
    }
  } catch (error) {
    logger.error('Expo push send failed', error);
  }
}
