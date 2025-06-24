export function escapeHTML(text: string): string {
  let result = '';
  let lastIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let escape = '';

    if (ch === '&') escape = '&amp;';
    else if (ch === '<') escape = '&lt;';
    else if (ch === '>') escape = '&gt;';

    if (escape) {
      result += text.slice(lastIndex, i) + escape;
      lastIndex = i + 1;
    }
  }

  if (lastIndex === 0) return text; // No escapes needed

  return result + text.slice(lastIndex);
}

export function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return `"${val.toISOString()}"`;
  }

  let str = String(val);
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}
