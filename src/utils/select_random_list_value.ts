export function selectRandomListValue<T>(values: T[]): T {
  if (values.length === 0) {
    throw new Error('Cannot select a value from empty array');
  }

  if (values.length === 1) {
    return values[0];
  }

  const index = Math.floor(Math.random() * values.length);
  const value = values[index];

  return value;
}
