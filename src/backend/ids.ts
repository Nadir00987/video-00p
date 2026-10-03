export function makeId(prefix: string) {
  const raw = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${raw}`;
}
