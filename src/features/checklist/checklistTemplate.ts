// Default travel checklist, transcribed from the owner's paper "TRAVEL CHECKLIST" form (Tick.pdf).
// Item ids are stable forever: user data stores only ticked ids and edits, never this text.
// Sections run in the order a trip actually happens (the paper form listed them by page position).
// Wording was kept except where the paper's item was personal or out of date (marked "reviewed"):
//  - "Keys for Greece" -> "Keys for destination or holiday home"  (reviewed)
//  - "E111 - Travel Insurance" -> "GHIC and travel insurance"  (E111 was replaced by the EHIC and then the UK GHIC)  (reviewed)
//  - "Nationwide New Debit card verifier" -> "Bank card reader / verifier"  (reviewed)
//  - "Visiting Company ID (e.g. Atofina, ETOL)" -> "Visiting company ID"  (reviewed)
export type TemplateSection = { id: string; title: string; hint?: string; items: { id: string; text: string }[] };

const s = (id: string, title: string, items: string[], hint?: string): TemplateSection => ({
  id, title, hint, items: items.map((text, i) => ({ id: `cl.${id}.${i + 1}`, text })),
});

export const TEMPLATE: TemplateSection[] = [
  s('advance', 'Days in advance', [
    'Visas', 'Travel insurance', 'Vaccination', 'Buy mosquito repellent and Imodium', 'Wash clothes',
  ], 'Things to sort out days before you go.'),
  s('clothes', 'Clothes and accessories', [
    'Under-clothes', 'Socks', 'Shirts', 'Jumpers', 'Trousers', 'Pyjamas', 'Shoes', 'Slippers', 'Dressing gown', 'Scarf',
    'Gloves', 'Suit', 'Ties', 'Jacket', 'Shorts', 'Winter cap / summer hat', 'Swimming suit', 'Anorak', 'Sandals', 'Belts',
  ]),
  s('bathroom', 'Bathroom bag', [
    'Shampoo', 'Soap', 'Wash glove', 'Water pik', 'Razor', 'Shaving foam', 'After-shave', 'Toothpaste and toothbrush',
  ]),
  s('accessories', 'Accessories', [
    'Ear-plugs', 'Eye mask', '2nd pair of glasses', 'Camera', 'Camera batteries', 'Towel', 'Malaria drug / medicines (check)',
    'Nail cutter', 'Knife', 'Bottle opener', 'Gifts', 'Mobile phone charger', 'Binoculars', 'Nuts / snacks for the trip',
    'Coffee, kettle, milk powder and envelopes', 'Digital bag for tourism', 'Scale for suitcase', 'Keys for destination or holiday home',
    'Tickets for events', 'Medicines kept outside the medicine bag (e.g. Lipitor)', 'Cream for feet and cream for itching',
    'Blood pressure measurement', 'Shoes for repair', 'Satellite navigator',
  ]),
  s('papers', 'Papers and documents', [
    'Ticket', 'Passport', 'Check passport expiry date', 'Certificate of vaccination', 'Driving licence', 'Bank card reader / verifier',
    'Guides and maps', 'Books and magazines', 'UK money, foreign money, chequebook, phone card', 'Old mobile phone for alarm',
    'GHIC and travel insurance', 'Smartphone charging battery', 'Address book (paper)', 'Town street finder',
    'Directions for hotel and hotel phone number', "Key people's addresses", 'Foreign plug adaptor', 'Switch on out-of-office assistant',
    'Extension lead', 'Pins for mobile phone and tooth floss stick', 'Watch',
  ]),
  s('work', 'Mostly work related', [
    'Computer', 'Visiting company ID', 'Work documents', 'E-mails / letters with directions etc.', 'Business cards',
    'Presentation pointer', 'VGA to HDMI converter', 'Print handouts for training', 'Charger', 'Car mobile phone holder',
  ], 'Hide this whole section if the trip is not for work.'),
  s('night', 'The night before', ['Order taxi', 'Iron clothes', 'Backup computer', 'Flight check-in']),
  s('last', 'Last minute', [
    'Coat in bag', 'Mobile phone', 'Waterpik', 'Electric toothbrush', 'Check plant watering', 'Switch off central heating',
    'Food (cheese etc.)', 'Empty bin', 'Check doors and windows',
  ]),
];

// Additions are appended within each original section: existing ids and saved ticks never shift.
const EXTRAS: Record<string, string[]> = {
  advance: ['Check entry and transit requirements', 'Check airline baggage allowance', 'Arrange airport transport', 'Check roaming or eSIM options', 'Share itinerary with a trusted contact'],
  clothes: ['Comfortable travel outfit', 'Spare outfit in cabin bag', 'Light layers for the flight', 'Laundry bag', 'Reusable shopping bag'],
  bathroom: ['Deodorant', 'Sunscreen', 'Lip balm', 'Hairbrush or comb', 'Period products, if needed'],
  accessories: ['Reusable water bottle (empty before security)', 'Headphones and charging cable', 'Luggage tags', 'Packing cubes', 'Hand sanitiser and tissues'],
  papers: ['Offline copies of bookings', 'Emergency contact details', 'Travel insurance contact number', 'Accommodation address saved offline', 'Copies of important documents stored securely'],
  work: ['Laptop power adaptor', 'Check access to work accounts', 'Offline copy of presentation', 'USB-C or display adaptor', 'Notebook and pen'],
  night: ['Charge phone and power bank', 'Download boarding pass', 'Check flight and airport updates', 'Set departure alarm', 'Separate cabin and hold baggage'],
  last: ['Check passport and boarding pass are accessible', 'Take house keys and wallet', 'Unplug non-essential appliances', 'Check transport pickup time', 'Take essential medicines in cabin bag'],
};
for (const section of TEMPLATE) {
  const offset = section.items.length;
  section.items.push(...EXTRAS[section.id].map((text, i) => ({id: `cl.${section.id}.${offset + i + 1}`, text})));
}

export const TEMPLATE_ITEM_COUNT = TEMPLATE.reduce((n, sec) => n + sec.items.length, 0);
