import { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { startOfWeek } from 'date-fns/startOfWeek';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { subMonths } from 'date-fns/subMonths';

export type DateCandidate = { from: string; to: string; label: string };
export type DateResolution = {
  phrase: string; kind: 'day' | 'range' | 'since' | 'last_mention';
  candidates: DateCandidate[]; ambiguous: boolean;
};
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthPattern = months.map(month => month.slice(0, 3) + (month.length > 3 ? `(?:${month.slice(3)})?` : '')).join('|');
const weekdayPattern = weekdays.join('|');
const namedDate = `(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthPattern})|(?:${monthPattern})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:,?\\s+\\d{4})?`;
const relative = `(?:day before yesterday|earlier today|this (?:morning|afternoon)|today|yesterday|\\d+\\s+(?:days?|weeks?) ago|(?:this|last) (?:week|month)|(?:last\\s+|on\\s+)?(?:${weekdayPattern})|${namedDate})`;
const pattern = new RegExp(`\\b(?:last time (?:we talked|we discussed|I asked)|since we (?:last )?(?:talked|discussed|spoke)|(?:since\\s+)?${relative})\\b`, 'gi');
const dateKey = (date: Date) => format(date, 'yyyy-MM-dd');
function candidate(from: Date, to = from): DateCandidate {
  return { from: dateKey(from), to: dateKey(to), label: dateKey(from) === dateKey(to) ? format(from, 'EEE d MMM yyyy') : `${dateKey(from)} to ${dateKey(to)}` };
}

/** Calendar arithmetic uses TZDate, never elapsed 24-hour periods across DST. */
export function resolveDates(text: string, now: Date, tz: string): DateResolution[] {
  const local = new TZDate(now.getTime(), tz);
  const today = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0, tz);
  const resolutions: DateResolution[] = [];
  for (const match of text.matchAll(pattern)) {
    const phrase = match[0];
    if (/^\.[a-z0-9]/i.test(text.slice(match.index + phrase.length))) continue;
    let value = phrase.toLowerCase();
    if (/^(last time|since we)/.test(value)) {
      resolutions.push({ phrase, kind: 'last_mention', candidates: [], ambiguous: false });
      continue;
    }
    const since = value.startsWith('since ');
    if (since) value = value.slice(6);
    let kind: DateResolution['kind'] = since ? 'since' : 'day';
    let candidates: DateCandidate[] = [];
    if (/^(today|earlier today|this morning|this afternoon)$/.test(value)) candidates = [candidate(today)];
    else if (value === 'yesterday') candidates = [candidate(addDays(today, -1))];
    else if (value === 'day before yesterday') candidates = [candidate(addDays(today, -2))];
    else if (/^\d+ /.test(value) && / ago$/.test(value)) {
      const count = Number.parseInt(value, 10);
      if (count > 365000) continue;
      if (value.includes('week')) {
        const middle = addDays(today, -7 * count);
        candidates = [candidate(addDays(middle, -3), addDays(middle, 3))]; kind = since ? 'since' : 'range';
      } else candidates = [candidate(addDays(today, -count))];
    } else if (/^(this|last) (week|month)$/.test(value)) {
      const last = value.startsWith('last');
      if (value.endsWith('week')) {
        const monday = startOfWeek(today, { weekStartsOn: 1 });
        candidates = [last ? candidate(addDays(monday, -7), addDays(monday, -1)) : candidate(monday, today)];
      } else {
        const month = last ? subMonths(today, 1) : today;
        candidates = [candidate(startOfMonth(month), last ? endOfMonth(month) : today)];
      }
      kind = since ? 'since' : 'range';
    } else if (new RegExp(`^(?:on |last )?(?:${weekdayPattern})$`).test(value)) {
      const word = value.split(' ').at(-1)!;
      const bare = value === word;
      // Bare weekdays need a sentence position; avoid incidental names inside prose.
      if (bare && !since && text.slice(0, match.index).trim() && !/[.!?]\s*$/.test(text.slice(0, match.index))) continue;
      const distance = (today.getDay() - weekdays.indexOf(word) + 7) % 7 || 7;
      const past = addDays(today, -distance);
      candidates = [candidate(past)];
      if (value.startsWith('last ')) candidates.push(candidate(addDays(past, -7)));
    } else {
      const parts = value.replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(',', '').split(/\s+/);
      const monthIndex = months.findIndex(month => month.slice(0, 3) === parts.find(part => /^[a-z]/.test(part))?.slice(0, 3));
      const numbers = parts.filter(part => /^\d+$/.test(part)).map(Number);
      if (monthIndex < 0 || !numbers.length) continue;
      let year = numbers[1] ?? today.getFullYear();
      let date = new TZDate(year, monthIndex, numbers[0], 12, 0, 0, tz);
      if (numbers[1] === undefined && dateKey(date) > dateKey(today)) date = new TZDate(--year, monthIndex, numbers[0], 12, 0, 0, tz);
      if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== numbers[0]) continue;
      candidates = [candidate(date)];
    }
    if (since) candidates = candidates.filter(c => c.from <= dateKey(today)).map(c => ({ ...c, to: dateKey(today), label: `${c.from} to ${dateKey(today)}` }));
    if (candidates.length) resolutions.push({ phrase, kind, candidates, ambiguous: candidates.length > 1 });
  }
  return resolutions;
}
