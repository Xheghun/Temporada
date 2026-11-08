export function formatSeasonDate(value: string, locale: string) {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(parsed);
}
