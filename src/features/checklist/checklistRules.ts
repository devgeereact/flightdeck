// Packing suggestions from simple, explainable rules: where the trip goes, the weather there right now, how far, how long.
// Never an AI guess, never an entry or visa rule (those live on official government pages). Every suggestion says WHY it appears.
import type { TripContext } from './tripContext';

export type Suggestion = { id: string; text: string; section: string; why: string };
type Rule = {
  id: string;
  when: (c: TripContext, nights: number | null) => boolean;
  text: string;
  section: string;
  why: (c: TripContext, nights: number | null) => string;
};

const rules: Rule[] = [
  {
    id: 'sg.gov-advice',
    when: (c) => c.intl === true && c.dir === 'outbound',
    text: 'Check entry rules on GOV.UK foreign travel advice',
    section: 'advance',
    why: (c) =>
      `You are flying to ${c.destName}. Entry rules and health advice are set by each country.`,
  },
  {
    id: 'sg.bank',
    when: (c) => c.intl === true,
    text: 'Tell your bank you are travelling',
    section: 'advance',
    why: () => 'Card payments abroad can be blocked if your bank is not expecting them.',
  },
  {
    id: 'sg.roaming',
    when: (c) => c.intl === true && c.dir === 'outbound',
    text: 'Sort roaming charges or an eSIM',
    section: 'papers',
    why: () => 'Mobile data abroad can cost much more than at home.',
  },
  {
    id: 'sg.id',
    when: (c) => c.dir === 'domestic',
    text: 'Photo ID for the airport',
    section: 'papers',
    why: () =>
      'This is a flight within the UK. Airlines usually ask for photo ID at check-in or the gate.',
  },
  {
    id: 'sg.cold',
    when: (c) => c.tempC !== null && c.tempC <= 5,
    text: 'Thermal layers',
    section: 'clothes',
    why: (c) => `It is ${c.tempC}°C in ${c.destName} right now.`,
  },
  {
    id: 'sg.rain',
    when: (c) => c.rain === true,
    text: 'Umbrella or light rain jacket',
    section: 'clothes',
    why: (c) => `Rain is reported in ${c.destName} right now.`,
  },
  {
    id: 'sg.sun',
    when: (c) => c.tempC !== null && c.tempC >= 24,
    text: 'Sun cream',
    section: 'bathroom',
    why: (c) => `It is ${c.tempC}°C in ${c.destName} right now.`,
  },
  {
    id: 'sg.sunglasses',
    when: (c) => c.tempC !== null && c.tempC >= 24,
    text: 'Sunglasses',
    section: 'accessories',
    why: (c) => `It is ${c.tempC}°C in ${c.destName} right now.`,
  },
  {
    id: 'sg.longhaul-clothes',
    when: (c) => c.km !== null && c.km >= 3500,
    text: 'Change of clothes in your cabin bag',
    section: 'clothes',
    why: (c) =>
      `A long flight (about ${c.km!.toLocaleString('en-GB')} km). A late suitcase is easier with a spare outfit.`,
  },
  {
    id: 'sg.neck-pillow',
    when: (c) => c.km !== null && c.km >= 3500,
    text: 'Neck pillow',
    section: 'accessories',
    why: () => 'It is a long flight.',
  },
  {
    id: 'sg.entertainment',
    when: (c) => c.km !== null && c.km >= 3500,
    text: 'Download films, music or books for the flight',
    section: 'accessories',
    why: () => 'It is a long flight.',
  },
  {
    id: 'sg.laundry',
    when: (_c, n) => n !== null && n >= 7,
    text: 'Laundry bag',
    section: 'accessories',
    why: (_c, n) => `You are away ${n} nights.`,
  },
  {
    id: 'sg.wash',
    when: (_c, n) => n !== null && n >= 7,
    text: 'Travel-size laundry wash',
    section: 'bathroom',
    why: (_c, n) => `You are away ${n} nights.`,
  },
  {
    id: 'sg.home',
    when: (c) => c.dir === 'inbound',
    text: 'Plan your journey home from the airport',
    section: 'last',
    why: () => 'You are flying home. Late arrivals can leave few transport options.',
  },
  {
    id: 'sg.customs',
    when: (c) => c.dir === 'inbound' && c.intl === true,
    text: 'Check what you can bring into the UK',
    section: 'last',
    why: () => 'You are returning from abroad. Allowances for goods are on GOV.UK.',
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @param existing the visible item texts of the list (a suggestion that is already on the list is not offered again)
 * @param dismissed suggestion ids the user has dismissed for this trip
 */
export function suggest(
  ctx: TripContext | null | undefined,
  nights: number | null | undefined,
  existing: string[],
  dismissed: Iterable<string> = [],
  max = 6,
): Suggestion[] {
  if (!ctx) return [];
  const have = existing.map(norm);
  const gone = new Set(dismissed);
  const n = typeof nights === 'number' && Number.isFinite(nights) && nights > 0 ? nights : null;
  const out: Suggestion[] = [];
  for (const r of rules) {
    if (out.length >= max) break;
    if (gone.has(r.id) || !r.when(ctx, n)) continue;
    const t = norm(r.text);
    if (have.some((h) => h === t || h.includes(t))) continue; // an existing item that already says all of it; a short word like "Jacket" must not hide a longer suggestion
    out.push({ id: r.id, text: r.text, section: r.section, why: r.why(ctx, n) });
  }
  return out;
}

export const RULE_IDS = rules.map((r) => r.id);
