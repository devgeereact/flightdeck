// Public pages. Plain HTML strings so they can be rendered to static files (search engines and AdSense cannot run the app).
// Rules for everything written here: describe only what the app really does; never state a legal right, entry rule or flight fact that
// is not certain; link to the official source instead. Dated facts carry the review date from site.config.json.

const who = (s) => (s.ownerName ? `${s.ownerName}, who runs Flightdeck` : 'the person who runs Flightdeck (the "site owner")');
const reach = (s) => (s.contactEmail
  ? `by email at <a href="mailto:${s.contactEmail}">${s.contactEmail}</a> or through our <a href="/contact/">contact form</a>`
  : 'through our <a href="/contact/">contact form</a>');

export const pages = (s) => [
  /* ------------------------------------------------------------------ legal */
  {
    slug: 'privacy', kind: 'legal', title: 'Privacy policy', description: 'What Flightdeck collects, why, who it is shared with, how long it is kept, and your rights.',
    body: `
<p>This policy explains what personal data Flightdeck handles and why. It was last reviewed on ${s.lastReviewed}. Flightdeck is run by ${who(s)}, who decides how your data is used (the "controller" under UK data protection law). You can reach us ${reach(s)}.</p>

<h2>The short version</h2>
<ul>
<li>You can use the public pages (this site's guides and the packing list) without an account and without giving us anything.</li>
<li>To search flights and keep a packing list you create an account. We use a sign-in service (Clerk) for that, so we never see or store your password.</li>
<li>We count how the app is used with simple anonymous totals on our own server. We cannot tell from them who did what.</li>
<li>Google Analytics is used <strong>only if you accept it</strong> in the cookie choice. If you reject it, nothing is sent to Google.</li>
<li>We do not sell your data and we do not show advertising.</li>
</ul>

<h2>What we collect, why, and our legal basis</h2>
<table>
<thead><tr><th>What</th><th>Why</th><th>Basis</th></tr></thead>
<tbody>
<tr><td><strong>Account details</strong>: your email address, and a name or picture if your sign-in method provides one. Held by our sign-in provider Clerk.</td><td>So you can sign in and so your saved flights and packing list stay yours.</td><td>Contract (providing the service you asked for)</td></tr>
<tr><td><strong>Saved flights</strong>: flight numbers and dates you choose to save. Stored in your Clerk profile.</td><td>So they follow you across devices.</td><td>Contract</td></tr>
<tr><td><strong>Packing list</strong>: your trip names, ticks and the items you add or hide. Stored on our server under a scrambled (hashed) version of your account id.</td><td>So your list is there next time and on your other devices.</td><td>Contract</td></tr>
<tr><td><strong>Flight searches</strong>: the flight number and date you type are sent to our server, which asks flight-data providers about that flight.</td><td>To show you the flight.</td><td>Contract</td></tr>
<tr><td><strong>Anonymous usage totals</strong>: counts such as searches per day, which airline codes and routes are searched, and how many different signed-in people used the app on a day. The "different people" figure uses a one-way scrambled code that changes every day, so one person cannot be followed from day to day, and the code is replaced by a plain number after two days.</td><td>To run and improve the service, and to keep within the limits of the paid data we use.</td><td>Legitimate interests (running a service safely and sustainably)</td></tr>
<tr><td><strong>Messages you send us</strong> through the contact form or the Feedback button: your message, and your name and email if you give them.</td><td>To read and answer you.</td><td>Legitimate interests / your request</td></tr>
<tr><td><strong>Technical information</strong> such as your IP address, held briefly by our host, Cloudflare and our server to deliver the site and to stop abuse (for example, limiting how many requests one visitor can make).</td><td>Security and reliability.</td><td>Legitimate interests</td></tr>
<tr><td><strong>Google Analytics</strong> (only if you accept): pages viewed and a few anonymous actions such as "searched for a flight" (never the flight number), with device, browser and approximate location that Google derives.</td><td>To understand how the app is used so we can improve it.</td><td>Consent. You can withdraw it at any time with "Cookie settings".</td></tr>
</tbody>
</table>

<h2>Who else handles data</h2>
<ul>
<li><strong>Clerk</strong> (sign-in and account storage). It may process data outside the UK; it is responsible for the security of the account details it holds.</li>
<li><strong>Cloudflare</strong> (delivers the site and protects it from abuse) and our <strong>web host</strong>.</li>
<li><strong>Flight-data providers</strong>: AeroDataBox (schedules, gates), The OpenSky Network (live aircraft position), adsbdb (usual routes) and Open-Meteo (weather). Our server contacts them for you. They receive the flight number or an airport location, <strong>not</strong> your name, email or IP address.</li>
<li><strong>Google</strong>: Google Analytics only if you accept it, as above. Our typefaces are hosted by us, so your browser does not contact Google just to display text.</li>
<li>If sending you a reply needs an email provider, that provider handles the message in transit.</li>
</ul>
<p>We only share data where it is needed to run the service, where you ask us to, or where the law requires it.</p>

<h2>How long we keep it</h2>
<ul>
<li>Account details and saved flights: until you delete your account.</li>
<li>Packing list: until you delete it (the packing list page has a button for this) or ask us to.</li>
<li>Anonymous usage totals: up to 400 days, then deleted.</li>
<li>Messages: for as long as needed to answer you and keep a record of the conversation. We delete them on request.</li>
</ul>

<h2>Your rights</h2>
<p>You can ask us to show you the data we hold about you, correct it, delete it, restrict or stop using it, or give it to you in a portable form. Where we rely on consent you can withdraw it at any time. To use any of these, contact us ${reach(s)}. To delete your account, use the account menu (your picture, top right) and choose to manage your account. If you are unhappy with how we handle your data you can complain to the UK Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/" rel="noopener">ico.org.uk</a>.</p>

<h2>Children</h2>
<p>Flightdeck is not aimed at children under 13 and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>If we change what we do with your data we will update this page and its date. If we ever start showing advertising we will update this policy first and ask for your consent where the law requires it.</p>`,
  },
  {
    slug: 'cookies', kind: 'legal', title: 'Cookies and similar technologies', description: 'The cookies and browser storage Flightdeck uses, which are essential, and how to change your analytics choice.',
    body: `
<p>This page lists what Flightdeck stores in your browser. Last reviewed ${s.lastReviewed}. Cookies and similar technologies are small pieces of information a site keeps on your device.</p>

<h2>Always on: essential</h2>
<p>These are needed to sign you in and to make the app work. They do not track you across other sites, so they do not need consent.</p>
<table>
<thead><tr><th>Name</th><th>What it is for</th><th>How long</th></tr></thead>
<tbody>
<tr><td>Clerk sign-in cookies (for example <code>__session</code>, <code>__client_uat</code>)</td><td>Keep you signed in and prove who you are to our server.</td><td>While you are signed in, up to about a week</td></tr>
<tr><td><code>flightdeck-saved</code>, <code>flightdeck-checklist</code> (browser storage)</td><td>Keep your saved flights and packing list on this device so they work offline.</td><td>Until you sign out (if tied to an account) or clear your browser data</td></tr>
<tr><td><code>fd-consent</code> (browser storage)</td><td>Remembers your cookie choice.</td><td>Until you change it or clear your browser data</td></tr>
<tr><td>App files (service worker cache)</td><td>Lets the app load quickly and work without a connection.</td><td>Until the app updates</td></tr>
</tbody></table>

<h2>Only if you accept: analytics</h2>
<p>Google Analytics 4 helps us count visits and see which parts of the app are used. It is switched off until you press <strong>Accept analytics</strong>. Before that, nothing is requested from Google.</p>
<table>
<thead><tr><th>Name</th><th>What it is for</th><th>How long</th></tr></thead>
<tbody>
<tr><td><code>_ga</code>, <code>_ga_&lt;id&gt;</code></td><td>Tell visits apart and count them.</td><td>Up to 2 years</td></tr>
</tbody></table>
<p>We have turned off Google's advertising features for this site: no advertising personalisation and no Google signals. We do not send your name, email, account id or flight numbers to Google.</p>

<h2>Advertising</h2>
<p>Flightdeck does not currently use advertising cookies. If that changes, this page and the privacy policy will be updated first and you will be asked before any advertising cookie is set.</p>

<h2>Change your choice</h2>
<p>You can change your analytics choice at any time with <a href="#" data-fd-cookie-settings>Cookie settings</a>. You can also clear cookies and site data in your browser settings. Clearing essential data will sign you out.</p>`,
  },
  {
    slug: 'terms', kind: 'legal', title: 'Terms of use', description: 'The terms for using Flightdeck: what it is for, what it cannot promise, and how accounts work.',
    body: `
<p>These terms apply when you use Flightdeck at ${s.url}. Last reviewed ${s.lastReviewed}. By using it you agree to them. If you do not agree, please do not use it.</p>

<h2>What Flightdeck is</h2>
<p>Flightdeck helps you follow a flight and get ready for a trip: status and times, gates and baggage belts when they are reported, the aircraft's position when it can be seen, the weather at the destination, and a packing list. It is provided free of charge, as it is, for your own personal use.</p>

<h2>Flight information can be wrong or late</h2>
<p>The information comes from third-party providers and can be delayed, incomplete or wrong, and airlines and airports change gates, times and terminals at short notice. Where a detail is not reported we show that it is not reported rather than guess. <strong>Always follow the instructions of your airline and the airport, and check airport screens.</strong> Do not rely on Flightdeck for decisions where being wrong would cause you harm or loss, such as when to leave for the airport.</p>

<h2>Your account</h2>
<ul>
<li>Keep your sign-in details to yourself. You are responsible for what happens under your account.</li>
<li>Give accurate information and use the service lawfully.</li>
<li>You can delete your account at any time from the account menu.</li>
</ul>

<h2>Please do not</h2>
<ul>
<li>use automated tools to search in bulk or to copy the data (the data belongs to its providers and our allowance with them is limited);</li>
<li>try to get around the sign-in, limits or security, or interfere with the service;</li>
<li>use it to harass anyone or for anything unlawful.</li>
</ul>
<p>We may limit or suspend access if the service is being abused.</p>

<h2>Our content and your content</h2>
<p>The design, text and code of Flightdeck belong to the site owner or its licensors. Flight, aircraft and weather data belong to their providers (see <a href="/about/">About</a>). What you add, such as packing list items and messages, stays yours; you let us store and show it back to you so the service can work.</p>

<h2>What we cannot promise</h2>
<p>We aim to keep Flightdeck running and accurate but we do not guarantee it will always be available or error-free, and features may change or end. Nothing in these terms limits any right you have that cannot be limited by law, including liability for death or personal injury caused by negligence, or for fraud. Subject to that, we are not responsible for losses that come from relying on information shown in the app, for missed flights, or for losses we could not reasonably have foreseen.</p>

<h2>Links to other sites</h2>
<p>We link to official sources such as airlines and government pages. We do not control them and are not responsible for them.</p>

<h2>Changes and law</h2>
<p>We may update these terms; the date above shows the latest review. These terms are governed by the law of England and Wales, and the courts of England and Wales can deal with disputes, although if you live elsewhere in the UK you may also be able to use your local courts. Questions about these terms: contact us ${reach(s)}.</p>`,
  },
  {
    slug: 'about', kind: 'legal', title: 'About Flightdeck', description: 'What Flightdeck is, where its data comes from, and how it avoids guessing.',
    body: `
<p>Flightdeck helps you follow a flight and get ready for a trip. It answers the questions people ask at the airport and the night before: is it on time, which terminal, which gate, where is the plane, what should I pack.</p>

<h2>It does not guess</h2>
<p>Many flight details are simply not available for every flight, especially gates and baggage belts, which airlines and airports often assign late. When a detail is not reported, Flightdeck says so. Times are labelled <em>scheduled</em>, <em>estimated</em> or <em>actual</em>, and anything we work out ourselves, such as how far along the journey is, is labelled as an estimate.</p>

<h2>Where the data comes from</h2>
<ul>
<li><a href="https://aerodatabox.com/" rel="noopener">AeroDataBox</a>: flight schedules, estimated and actual times, terminals, gates and baggage belts, aircraft type.</li>
<li><a href="https://opensky-network.org/" rel="noopener">The OpenSky Network</a>: the live position of aircraft that are transmitting and within range of its receivers. Over oceans and remote areas there is often no position.</li>
<li><a href="https://www.adsbdb.com/" rel="noopener">adsbdb</a>: the usual route for a flight number, used to tell you where a flight normally goes when no schedule is published yet.</li>
<li><a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a>: current weather at the destination airport area.</li>
</ul>

<h2>Outbound and inbound</h2>
<p>Flightdeck tells you whether a flight leaves from or arrives in the United Kingdom, worked out from the airports on its route. <a href="/guides/outbound-and-inbound-flights/">Read how it works</a>.</p>

<h2>Who runs it</h2>
<p>Flightdeck is run by ${who(s)}. Feedback is welcome ${reach(s)}.</p>`,
  },
  {
    slug: 'contact', kind: 'contact', title: 'Contact us', description: 'Send a question, a problem report or feedback about Flightdeck.',
    body: `
<p>${s.contactEmail ? `You can email <a href="mailto:${s.contactEmail}">${s.contactEmail}</a> or use` : 'Use'} the form below. We read every message. Please do not include passwords or payment details.</p>
<form id="contact-form" class="pub-form" novalidate>
 <div class="pub-kinds" role="radiogroup" aria-label="What is this about?">
  <label><input type="radio" name="kind" value="contact" checked> A question</label>
  <label><input type="radio" name="kind" value="bug"> A problem</label>
  <label><input type="radio" name="kind" value="feedback"> Feedback</label>
 </div>
 <label class="pub-f"><span>Your message</span><textarea name="message" rows="6" minlength="5" maxlength="4000" required></textarea></label>
 <div class="pub-row">
  <label class="pub-f"><span>Your name (optional)</span><input name="name" maxlength="80" autocomplete="name"></label>
  <label class="pub-f"><span>Your email (needed for a reply)</span><input name="email" type="email" maxlength="254" autocomplete="email" required></label>
 </div>
 <input class="pub-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
 <p id="contact-msg" role="status" aria-live="polite"></p>
 <button class="pub-btn" type="submit">Send message</button>
 <p class="pub-small">We use your details only to reply. See the <a href="/privacy/">privacy policy</a>.</p>
</form>
<script>
(function(){var f=document.getElementById('contact-form'),m=document.getElementById('contact-msg'),t0=Date.now();
f.addEventListener('submit',function(e){e.preventDefault();m.textContent='';var d=new FormData(f);
var body={kind:d.get('kind'),message:d.get('message'),name:d.get('name'),email:d.get('email'),website:d.get('website'),elapsed:Date.now()-t0};
if(!f.checkValidity()){m.textContent='Please write your message and add a valid email address.';return}
f.querySelector('button').disabled=true;
fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){
if(!x.ok)throw new Error(x.j.error||'Your message could not be sent.');f.reset();m.textContent='Thank you. Your message has been sent.'}).catch(function(err){m.textContent=err.message||'Your message could not be sent. Please try again.'}).then(function(){f.querySelector('button').disabled=false})});})();
</script>`,
  },

  /* ----------------------------------------------------------------- packing list (built from the app's template) */
  {
    slug: 'travel-checklist', kind: 'checklist', title: 'Printable packing list', description: 'A free printable packing list: clothes, bathroom bag, accessories, documents, the night before and last minute. Tick it on paper or keep it in Flightdeck.',
    // body is produced by the build script from src/checklistTemplate.ts so the app and this page can never disagree
    body: null,
  },

  /* ------------------------------------------------------------------ guides */
  {
    slug: 'guides/flight-status-explained', kind: 'guide', category: 'reading', takeaways: ["Scheduled is the plan, estimated is the current prediction, and actual is what happened.", "Leaving the gate and reaching the gate include taxiing, so they are longer than the time in the air.", "A delay can differ between departure and arrival, and times are in each airport's own time zone."], title: 'Flight status explained: scheduled, estimated and actual times', description: 'What check-in, boarding, leaving the gate, take-off, landing and reaching the gate mean, why times change, and how to read a flight status without being misled.',
    body: `
<p>A flight status page can look like a jumble of times. They each mean something specific, and knowing which is which tells you what is really happening.</p>
<h2>The three kinds of time</h2>
<ul>
<li><strong>Scheduled</strong> is the time in the airline's timetable. It is the plan, and it rarely changes after it is published.</li>
<li><strong>Estimated</strong> is the best current prediction. It moves as the flight is delayed or runs early. An estimate is not a promise.</li>
<li><strong>Actual</strong> is what happened. It only exists once the event is over.</li>
</ul>
<h2>The moments of a flight, in order</h2>
<ol>
<li><strong>Check-in</strong>: bag drop and security. Airlines publish when it opens and closes, and the airport screens show which desk to use.</li>
<li><strong>Boarding</strong>: passengers are called to the aircraft. Many airlines and airports do not publish this time.</li>
<li><strong>Leaving the gate</strong> (airlines call it gate out or off-blocks): the aircraft pushes back from its parking stand. Airlines use this time to measure departure punctuality.</li>
<li><strong>Take-off</strong>: the wheels leave the runway. This is usually some minutes after the aircraft leaves the gate, because it has to taxi and queue.</li>
<li><strong>Landing</strong>: the wheels touch the runway at the destination.</li>
<li><strong>Reaching the gate</strong> (gate in or on-blocks): the aircraft parks at the arrival stand. The doors open a little later.</li>
<li><strong>Bags on the belt</strong>: baggage takes longer again, and the belt number is often only shown shortly before or after landing.</li>
</ol>
<h2>Why the numbers differ</h2>
<p>The gap between take-off and landing is the time in the air. The gap between leaving the gate and reaching the gate is longer, because it includes taxiing at both ends. So an "11 hour flight" in the timetable is usually a little more than the time actually airborne.</p>
<h2>Reading a delay properly</h2>
<ul>
<li>A delay is the difference between scheduled and estimated (or actual) time. It can differ between departure and arrival: a flight can leave late and make up time in the air, or the reverse.</li>
<li>"On schedule" should only be shown when there is live information behind it. If an airport or airline provides only the timetable, a good status page says that the times are the schedule, not a live check.</li>
<li>Local times: departure and arrival times are in each airport's own time zone, so a flight can appear to land before it left.</li>
</ul>
<h2>How Flightdeck handles this</h2>
<p>Flightdeck marks every time as scheduled, estimated or actual. A step with no time shows as not reported rather than a guess, and anything Flightdeck works out itself, such as how far along the flight is, is marked as an estimate. <a href="/">Track a flight</a>.</p>`,
  },
  {
    slug: 'guides/outbound-and-inbound-flights', kind: 'guide', category: 'reading', takeaways: ["Use the route, not the flight number, to tell outbound from inbound.", "Odd and even numbering is a habit some airlines follow, not a rule.", "Outbound: check documents, terminal and bag drop. Inbound: check the belt, onward travel and customs."], title: 'Outbound and inbound flights: how to tell, and why it matters', description: 'How to tell whether a flight is leaving the UK or coming home, why flight numbers are only a hint, and what to check at each end.',
    body: `
<p>"Outbound" and "inbound" describe your journey relative to home. For a UK traveller, an outbound flight leaves the UK and an inbound flight arrives in it. The difference decides what you need to do and where you need to be.</p>
<h2>How to tell for certain</h2>
<p>The reliable way is the route. If the departure airport is in the UK and the arrival airport is abroad, it is outbound. If it is the other way round it is inbound. If both airports are in the UK it is a domestic flight, and if neither is, it is an international flight that does not touch the UK.</p>
<h2>Flight numbers are only a hint</h2>
<p>Some airlines number their flights so that one direction is odd and the opposite is even. British Airways does this on many routes, and an odd number often means a flight out of the UK. But it is a habit, not a rule: pairs are not always consecutive, routes change, and codeshare flights carry other airlines' numbers. Treat it as a clue, and confirm with the route. Flightdeck only uses the number when it does not yet know the route, and says so when it does.</p>
<h2>What to check for an outbound flight</h2>
<ul>
<li>Your passport and any entry requirements for the country you are going to. The official source is the <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>.</li>
<li>Your terminal. Airlines can use more than one terminal at a large airport, and sometimes move between them, so check on the day.</li>
<li>Check-in and bag drop times, which are set by the airline.</li>
</ul>
<h2>What to check for an inbound flight</h2>
<ul>
<li>Whether your arrival terminal is the one you expected, and which baggage belt your bags will use. Belts are often assigned only shortly before landing.</li>
<li>How you will get home from the airport, especially for late arrivals.</li>
<li>Any customs or border steps for the country you are returning from. See the <a href="https://www.gov.uk/duty-free-goods" rel="noopener">GOV.UK guidance on bringing goods into the UK</a>.</li>
</ul>
<p>Flightdeck shows a clear outbound / inbound label on each flight and, when the provider reports it, the terminal, gate and baggage belt. <a href="/">Track a flight</a>.</p>`,
  },
  {
    slug: 'guides/what-to-do-if-your-flight-is-delayed-or-cancelled', kind: 'guide', category: 'trouble', takeaways: ["Confirm the facts on the airport screens and the airline's app first.", "Contact the airline early, keep every receipt and note, and stay near the gate.", "For your rights, use official sources such as the CAA passenger advice."], title: 'What to do if your flight is delayed or cancelled', description: 'A calm packing list for the first hour of a delay or cancellation, and where to find your rights from official sources.',
    body: `
<p>A delay or cancellation is stressful, and the first hour matters most. This is a practical order of things to do. For your legal rights, always use the official sources linked below, because the rules depend on where you are flying from and to, which airline operates the flight, the length of the delay and the reason for it.</p>
<h2>In the first few minutes</h2>
<ol>
<li><strong>Confirm what is really happening.</strong> Check the airport screens and the airline's app or website. Flight tracking tools, including Flightdeck, can lag behind what the airline knows.</li>
<li><strong>Do not leave the airport area</strong> unless the airline tells you to. If you are re-booked or called to a gate, you need to be there.</li>
<li><strong>Keep your documents and bags with you,</strong> and keep your boarding pass and booking reference to hand.</li>
</ol>
<h2>Get in touch with the airline early</h2>
<ul>
<li>Use the airline's app or messaging first. Everyone else in the queue is about to try the desk.</li>
<li>Ask what they will do for you: another flight, a refund, or somewhere to stay. Ask them to confirm important things in writing or by email.</li>
</ul>
<h2>Keep a record</h2>
<ul>
<li>Note the time the delay was announced, the new departure time, and what you were told.</li>
<li>Keep receipts for meals, transport and anything you had to buy. You may be able to claim reasonable costs.</li>
<li>Take photos of the departure board if it shows the delay or cancellation.</li>
</ul>
<h2>Your rights, from official sources</h2>
<p>In the UK, rules on delays, cancellations and denied boarding are explained by the Civil Aviation Authority: <a href="https://www.caa.co.uk/passengers/" rel="noopener">CAA passenger advice</a>. If you booked a package holiday, your tour operator has its own responsibilities. If you paid by credit card, or have travel insurance, check those as well, because they can offer extra protection.</p>
<h2>Tell the people waiting for you</h2>
<p>Let whoever is meeting you know the new time. Flightdeck can show a flight's estimated arrival when the provider has one, and your trip packing list stays available offline while you wait.</p>`,
  },
  {
    slug: 'guides/pack-your-cabin-bag-for-a-long-flight', kind: 'guide', category: 'prepare', takeaways: ["Keep documents, phone, money and medicines on you, never in the hold.", "Pack a change of underwear and a wash kit in case your bag arrives late.", "Rules on liquids and batteries change, so check your airline and airport before you go."], title: 'Pack your cabin bag for a long flight', description: 'What to keep in the cabin bag on a long flight, what to put in the hold, and what to carry in your pocket.',
    body: `
<p>On a long flight your cabin bag is the one thing you can reach. Pack it well and a long flight is much easier. Treat this as a starting point and change it to suit you. The <a href="/travel-checklist/">printable packing list</a> covers the rest of the trip.</p>
<h2>Keep with you at all times</h2>
<ul>
<li>Passport, ticket or boarding pass, and any visas or entry paperwork.</li>
<li>Phone, charger, and a small power bank (check your airline's rules for power banks).</li>
<li>Money and cards, and a note of the hotel address and phone number.</li>
<li>Essential medicines in their original packaging, with a copy of any prescription. Keep these in the cabin bag, never in the hold.</li>
<li>Glasses or contact lenses, and a spare pair if you rely on them.</li>
</ul>
<h2>For comfort</h2>
<ul>
<li>A warm layer. Cabins can be cool even when the destination is hot.</li>
<li>Comfortable socks, an eye mask and ear-plugs or headphones.</li>
<li>A refillable water bottle to fill after security.</li>
<li>Lip balm and moisturiser: cabin air is dry.</li>
</ul>
<h2>Plan for a delayed bag</h2>
<p>Bags occasionally arrive later than you do. Pack one change of underwear and a basic wash kit in the cabin bag, so that a late suitcase is an inconvenience and not a crisis.</p>
<h2>Check the rules before you go</h2>
<p>Rules for liquids, batteries and sharp objects differ between airports and countries, and they change. Check your airline's baggage page and the security guidance of your departure airport shortly before you travel, and follow the instructions of security staff on the day.</p>
<h2>Put it on the list</h2>
<p>Add what you always forget to your own packing list in Flightdeck and it will be there on every trip.</p>`,
  },
  {
    slug: 'guides/baggage-reclaim-and-missing-bags', kind: 'guide', category: 'trouble', takeaways: ["The belt is often only known near landing, and it can change.", "If a bag does not arrive, report it before leaving the baggage hall and get a reference number.", "Report damage at the airport and photograph it, because deadlines can be short."], title: 'Baggage reclaim and what to do about a missing bag', description: 'How baggage reclaim works, why the belt is often not known until you land, and the steps to take if your bag does not arrive.',
    body: `
<p>After a long flight, the last obstacle is the baggage hall. Knowing how it works helps, and knowing what to do if your bag does not appear helps even more.</p>
<h2>Which belt?</h2>
<p>Baggage belts are assigned by the airport, often shortly before or after the aircraft lands, and the belt can change. That is why a flight tracker may show no belt until late, and why a belt shown early can be wrong. Check the screens in the arrivals hall, which are the authority on the day.</p>
<h2>Making your bag easy to spot</h2>
<ul>
<li>Use a bright strap, ribbon or tag. Many suitcases look alike.</li>
<li>Put your name, email and phone number inside the bag as well as on the outside tag.</li>
<li>Take a photo of your bag and keep the baggage receipt the airline gives you at check-in.</li>
</ul>
<h2>If your bag does not arrive</h2>
<ol>
<li><strong>Do not leave the baggage hall.</strong> Go to the airline's baggage desk (or the handling agent's) <strong>before you leave the airport</strong> and report it.</li>
<li>Ask for a written report and a reference number. You will need it for every later conversation.</li>
<li>Give an address where the bag can be delivered, and a phone number that works at your destination.</li>
<li>Keep receipts for essentials you have to buy while you wait, such as toiletries and basic clothing. Ask the airline what it will cover.</li>
<li>Follow up using the airline's online baggage tracking, with your reference number.</li>
</ol>
<p>Airlines are responsible for the bags they carry, and international carriers have to follow common rules on compensation for lost or damaged baggage. The details differ, so use the airline's own policy and the <a href="https://www.caa.co.uk/passengers/" rel="noopener">CAA passenger advice</a>, and check what your travel insurance covers.</p>
<h2>Damaged bags</h2>
<p>If your bag is damaged, report it at the airport before you leave, and make a photo record. Airlines often have a short deadline for damage reports, so do not wait until you get home.</p>`,
  },
  {
    slug: 'guides/flight-numbers-airline-codes-and-codeshares', kind: 'guide', category: 'reading', takeaways: ["A flight number is the airline code plus a number, and the date matters.", "IATA airport codes have three letters and ICAO codes have four.", "In a codeshare, check which airline actually operates the flight."], title: 'Flight numbers, airline codes and codeshares: what the letters and digits mean', description: 'How to read a flight number like BA117, what airport and airline codes stand for, and why one flight can carry several numbers.',
    body: `
<p>A flight number looks simple, but it carries a few separate pieces of information, and one aircraft can be sold under more than one number. Knowing how it is built helps you search correctly and avoid turning up for the wrong flight.</p>
<h2>How a flight number is built</h2>
<p>A flight number is the airline's code followed by a number, for example <strong>BA117</strong>. The two characters at the start identify the airline (the IATA airline designator). Most are two letters, but some include a digit, such as U2. The number after it is the airline's own reference for that service, and it may have up to four digits.</p>
<ul>
<li>The same flight number is normally used on the same route at the same time on many days, so the <strong>date</strong> matters. Searching a number without the right date can show a different day's flight.</li>
<li>Airlines can reuse a number for a different route later, so an old booking confirmation is not proof of today's flight.</li>
<li>A flight number is not a guide to direction. Some airlines use odd and even numbers for outbound and return legs, but there is no rule that all airlines follow.</li>
</ul>
<h2>Airport and airline codes</h2>
<ul>
<li><strong>IATA airport codes</strong> have three letters and are the ones on tickets and bag tags, such as LHR or JFK.</li>
<li><strong>ICAO airport codes</strong> have four letters and are used in aviation operations and by air traffic control. EGLL and KJFK are the ICAO codes for the same two airports.</li>
<li><strong>Callsigns</strong> are what pilots and controllers say on the radio. They often use the airline's three-letter ICAO code, so a flight sold as BA117 may be tracked on an air traffic display under a callsign beginning BAW. Callsigns can differ from the number on your ticket, which is one reason live tracking maps do not always match a booking at first glance.</li>
</ul>
<h2>What a codeshare is</h2>
<p>In a codeshare, one flight is sold by more than one airline, each under its own flight number. Only one airline actually operates the aircraft with its own crew. You may see two terms:</p>
<ul>
<li>The <strong>marketing carrier</strong> is the airline whose number you booked under.</li>
<li>The <strong>operating carrier</strong> is the airline that flies the aircraft. It controls check-in times for the aircraft, the gate and many of the day-to-day decisions.</li>
</ul>
<p>The practical effect: if your ticket says "operated by" another airline, check that airline's website or the airport's departure board. The partner's number may not appear on the airport screens, and you may need to look for the operating airline's number instead.</p>
<h2>Searching well</h2>
<ol>
<li>Use the flight number exactly as it appears on your booking, including any letters.</li>
<li>Enter the departure date for the airport where the flight starts, in that airport's local date.</li>
<li>If nothing is found, try the operating airline's number if your ticket shows one.</li>
<li>If it is still not found, it may be too far ahead for the airline to have published, so check again closer to the date.</li>
</ol>
<h2>How Flightdeck handles this</h2>
<p>Flightdeck asks for the flight number and the date, and shows only what a source actually reports. It does not guess a flight from a partial match. <a href="/">Track a flight</a> to see it, or read <a href="/guides/flight-status-explained/">how to read the times</a> once you have it.</p>`,
  },
  {
    slug: 'guides/departure-day-airport-timeline', kind: 'guide', category: 'prepare', takeaways: ["Follow your airline's advice on how early to arrive.", "Rules on liquids and electronics differ by airport, so check them shortly before you go.", "Watch the screens: gates are shown late and can change."], title: 'Departure day at the airport: a simple timeline', description: 'A calm step-by-step order for the day you fly, from checking your flight at home to the gate, with the checks worth doing at each stage.',
    body: `
<p>Most travel stress comes from not knowing what comes next. This is a general order for a departure day. Airlines and airports differ, so treat it as a frame and use your own airline's instructions for anything specific.</p>
<h2>Before you leave</h2>
<ul>
<li><strong>Check the flight.</strong> Look at the current status, departure time and, if shown, the terminal. Times can change after you booked.</li>
<li><strong>Check the airline's advice on arriving.</strong> Airlines publish how early they recommend you get to the airport. Follow their guidance and allow extra for travel to the airport.</li>
<li><strong>Documents.</strong> Passport or ID, boarding pass if you have it on your phone, and any visa or entry paperwork the destination needs. For entry requirements, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>.</li>
<li><strong>Phone and power.</strong> Charge your phone and carry a charger or power bank in your cabin bag, not in the hold.</li>
<li><strong>Bags.</strong> Re-check your allowance for cabin and hold bags on your airline's website, as limits vary by airline and fare.</li>
</ul>
<h2>At the airport</h2>
<ol>
<li><strong>Find your check-in or bag drop.</strong> Departure boards show the desk or zone for your flight. If you checked in online and have no hold bag, you can usually go straight to security.</li>
<li><strong>Drop your hold bag</strong> if you have one, and keep your boarding pass and ID to hand.</li>
<li><strong>Security.</strong> Rules for liquids, electronics and what must be taken out of bags differ by airport and can change, so read the airport's current guidance before you pack your cabin bag.</li>
<li><strong>After security.</strong> Check the departure screens. The gate is often shown only a short time before boarding, so do not go far from the screens until it appears.</li>
</ol>
<h2>At the gate</h2>
<ul>
<li>Listen for announcements and watch for a gate change. Gates do change.</li>
<li>Boarding usually starts before the departure time. Be at the gate by the time your airline asks.</li>
<li>If the flight is delayed, look at the airline's information first, and read <a href="/guides/what-to-do-if-your-flight-is-delayed-or-cancelled/">what to do if your flight is delayed or cancelled</a>.</li>
</ul>
<h2>When you land</h2>
<ul>
<li>Check the baggage belt on the arrivals screens or the airline's app. Belt numbers are often shown only after landing.</li>
<li>If a bag does not arrive, report it at the airline's desk before leaving the baggage hall. See <a href="/guides/baggage-reclaim-and-missing-bags/">baggage reclaim and missing bags</a>.</li>
</ul>
<h2>A short packing list for the night before</h2>
<p>Passports, chargers, medication, house keys and a final check of the flight. The full list is on the <a href="/travel-checklist/">printable packing list</a>.</p>`,
  },

];

export const guideCategories = [
  { id: 'reading', title: 'Understand your flight', blurb: 'Read times, numbers and directions the way the airline means them.' },
  { id: 'prepare', title: 'Prepare and pack', blurb: 'Get ready before you leave, and know the order of the day.' },
  { id: 'trouble', title: 'When things go wrong', blurb: 'Clear steps for delays, cancellations and bags that do not arrive.' },
];

export const guideIndex = {
  slug: 'guides', kind: 'index', title: 'Travel guides', description: 'Plain, practical guides for the days around a flight: reading flight status, delays, packing and baggage.',
};
