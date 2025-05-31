const options: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', options);
}
