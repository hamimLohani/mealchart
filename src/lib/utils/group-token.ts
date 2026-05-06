export function slugifyGroupName(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 8) || "GROUP";
}

function randomTokenSegment(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function generateGroupToken(groupName: string) {
  return `${slugifyGroupName(groupName)}-${randomTokenSegment(6)}`;
}
