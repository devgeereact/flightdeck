// Compares the Node reference API with the PHP API for deterministic endpoints.
// Usage: NODE_URL=http://127.0.0.1:3999 PHP_URL=http://127.0.0.1:3998 node php/tests/parity.mjs
const node = process.env.NODE_URL || 'http://127.0.0.1:3999';
const php = process.env.PHP_URL || 'http://127.0.0.1:3998';
const strip = (v) =>
  JSON.parse(
    JSON.stringify(v, (k, x) => (k === 'fetchedAt' ? '<time>' : k === 'providers' ? undefined : x)),
  );
const cases = [
  '/api/config',
  '/api/flights?number=BA117&date=2026-10-23&mode=demo',
  '/api/flights?number=ba%20117&date=2026-10-23&mode=demo',
  '/api/flights?number=EK2&date=2026-10-23&mode=demo',
  '/api/flights?number=AF1381&date=2026-12-31&mode=demo',
  '/api/flights?number=ZZ999&date=2026-10-23&mode=demo',
  '/api/flights?number=BA117&date=2026-02-30&mode=demo',
  '/api/flights?number=..%2Fsecret&date=2026-10-23&mode=demo',
  '/api/flights?date=2026-10-23&mode=demo',
  '/api/weather',
  '/api/weather?lat=abc&lon=1',
  '/api/weather?lat=91&lon=1',
  '/api/weather?lat=1&lon=181',
  '/api/nope',
];
let bad = 0;
for (const c of cases) {
  const [a, b] = await Promise.all([fetch(node + c), fetch(php + c)]);
  const [ja, jb] = [strip(await a.json()), strip(await b.json())];
  const same = a.status === b.status && JSON.stringify(ja) === JSON.stringify(jb);
  if (!same) bad++;
  console.log(same ? 'SAME ' : 'DIFF ', a.status, b.status, c);
  if (!same)
    console.log(
      '  node:',
      JSON.stringify(ja).slice(0, 300),
      '\n  php: ',
      JSON.stringify(jb).slice(0, 300),
    );
}
console.log(bad ? `\n${bad} differences` : '\nAll cases identical');
process.exit(bad ? 1 : 0);
