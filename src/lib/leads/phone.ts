// Trunk-zero country codes where a leading 0 after the country code needs
// stripping for E.164 (e.g. +61 04xx -> +614xx) — ports the source system's
// normalizePhoneE164 exactly, same 5 codes (AU, LK, NZ, UK, IN).
const TRUNK_ZERO_COUNTRY_CODES = ["61", "94", "64", "44", "91"];

/** For outbound dialing (Aircall's API expects E.164). Returns null if the number has no country code — can't safely guess one, matching the source system's "leave as-is" behavior, except here that ambiguous case is treated as unusable for an API call rather than sent through unnormalized. */
export function normalizeToE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  for (const cc of TRUNK_ZERO_COUNTRY_CODES) {
    const prefix = `+${cc}0`;
    if (digits.startsWith(prefix)) {
      return `+${cc}${digits.slice(prefix.length)}`;
    }
  }
  return digits;
}

/** Digits only, no country-code awareness — ports the source system's aircallNormalizePhone, used purely for fuzzy-matching an inbound caller id against stored lead phone numbers. */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D+/g, "");
}

/**
 * Ports the source system's aircallPhonesMatch exactly: exact digit match,
 * OR the shorter number's last-8-digits appear as the other's suffix (handles
 * +61 4xx vs 04xx style prefix differences without needing full E.164 on
 * both sides). Numbers under 6 digits never match — too short to be
 * meaningful.
 */
export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (da.length < 6 || db.length < 6) return false;
  if (da === db) return true;
  const suffixLen = Math.min(8, da.length, db.length);
  return da.slice(-suffixLen) === db.slice(-suffixLen);
}
