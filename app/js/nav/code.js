// nav/code.js — Daily rental code parser & validator.
//
// Code format: sablava{HH}{MM}{DD}
//   HH = duration key: "01"=1h, "15"=1.5h, "02"=2h, "03"=3h
//   MM = 2-digit month (01–12)
//   DD = 2-digit day (01–31)
//
// Example: "sablava030528" → 3h rental, issued 28 May
// No server required — validated purely by date matching + known HH values.
// Security intent: friction gate only (salt is client-side).

const DURATION_TABLE = { "01": 1, "15": 1.5, "02": 2, "03": 3 };

/**
 * Parse a raw code string.
 * @param {string} input
 * @returns {{ durationHours: number, month: number, day: number } | null}
 */
export function parseCode(input) {
  const match = /^sablava(\d{2})(\d{2})(\d{2})$/i.exec(
    (input ?? "").trim().toLowerCase()
  );
  if (!match) return null;
  const [, hh, mm, dd] = match;
  if (!(hh in DURATION_TABLE)) return null;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { durationHours: DURATION_TABLE[hh], month, day };
}

/**
 * Check whether a parsed code was issued for today's date.
 * Once a session is started the date check is NOT re-run — overnight sessions allowed.
 * @param {{ month: number, day: number }} parsed
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isValidForToday(parsed, now = new Date()) {
  if (!parsed) return false;
  return parsed.month === now.getMonth() + 1 && parsed.day === now.getDate();
}
