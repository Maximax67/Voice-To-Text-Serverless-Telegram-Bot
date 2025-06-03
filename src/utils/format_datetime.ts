const options: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', options);

export function formatDateTime(date: string | Date): string {
  const dateObject = date instanceof Date ? date : new Date(date);
  const parts = dateTimeFormatter.formatToParts(dateObject);

  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';

  return `${day}.${month}.${year} ${hour}:${minute}`;
}
