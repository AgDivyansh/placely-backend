/**
 * Alumni status is COMPUTED, never stored — no cron flips a flag, no login
 * hook mutates a role. We derive it from the immutable `graduationYear`, so
 * even a 7-day-old JWT snapshot resolves correctly against today's date.
 *
 * Rule: a user is an alumnus once the calendar reaches July 1 of their
 * graduation year (month index 6). Before that they're a current student.
 * A single cutoff keeps this trivial to reason about — no per-college config.
 */
export function isAlumni(graduationYear?: number | null, now: Date = new Date()): boolean {
  if (graduationYear == null) return false;
  return now >= new Date(graduationYear, 6, 1);
}
