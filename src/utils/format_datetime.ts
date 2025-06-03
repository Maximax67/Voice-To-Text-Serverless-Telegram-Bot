import { UTC_OFFSET } from '../config';

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
  let inputDate = date instanceof Date ? date : new Date(date);
  let utcLabel: string;

  if (UTC_OFFSET) {
    const utcOffsetMs = UTC_OFFSET * 60 * 60 * 1000;
    inputDate = new Date(inputDate.getTime() + utcOffsetMs);
    utcLabel = `UTC${UTC_OFFSET > 0 ? `+${UTC_OFFSET}` : UTC_OFFSET}`;
  } else {
    utcLabel = 'UTC';
  }

  const parts = dateTimeFormatter.formatToParts(inputDate);

  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';

  return `${day}.${month}.${year} ${hour}:${minute} ${utcLabel}`;
}
