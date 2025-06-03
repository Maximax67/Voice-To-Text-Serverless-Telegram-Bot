const options: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

export function formatDate(date: string | Date): string {
  const dateObject = date instanceof Date ? date : new Date(date);

  return dateObject.toLocaleDateString('en-US', options);
}
