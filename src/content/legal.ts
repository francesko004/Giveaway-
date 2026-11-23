/**
 * Default legal templates (Albanian + English).
 *
 * ⚠️ These are starting templates only. They have NOT been reviewed by a lawyer.
 * Before launch, have qualified counsel review them against the Albanian personal data
 * protection law currently in force (the GDPR-aligned law that replaced Law No. 9887/2008 —
 * confirm the exact act and number with counsel), the GDPR where EU residents are targeted,
 * consumer-protection rules and any rules on promotional games / prize competitions.
 *
 * Placeholders: {{companyName}}, {{companyLegalName}}, {{companyNipt}}, {{address}},
 * {{contactEmail}}, {{contactPhone}}, {{retentionDays}}
 */
export const DEFAULT_TERMS = {
  sq: `## 1. Organizatori
Ky konkurs dhuratash organizohet nga **{{companyLegalName}}** ({{companyName}}), NIPT {{companyNipt}}, me adresë {{address}}.

## 2. Pjesëmarrja është falas
Pjesëmarrja nuk kërkon asnjë blerje ose pagesë. Blerja nuk rrit shanset për të fituar.

## 3. Kush mund të marrë pjesë
Mund të marrin pjesë personat që plotësojnë kushtet e pranueshmërisë të publikuara në faqen e konkursit. Punonjësit e organizatorit dhe familjarët e tyre të afërt nuk mund të marrin pjesë, përveç nëse përcaktohet ndryshe.

## 4. Si të merrni pjesë
Plotësoni formularin e regjistrimit brenda periudhës së konkursit. Lejohet **një regjistrim për person** (i njëjti email ose numër telefoni nuk mund të regjistrohet dy herë). Regjistrimet e automatizuara, të dyfishta ose me të dhëna të rreme do të shpallen të pavlefshme, me arsye të regjistruar.

## 5. Përzgjedhja e fituesit
Pas mbylljes së regjistrimeve, lista e regjistrimeve të vlefshme ngrihet dhe publikohet hash-i i saj SHA-256. Fituesi përzgjidhet automatikisht nga një raund i ardhshëm i rastësisë publike **drand** (League of Entropy), i përcaktuar përpara se të ekzistojë. Rezultati mund të verifikohet nga kushdo në faqen publike të verifikimit.

## 6. Njoftimi dhe marrja e çmimit
Fituesi njoftohet me email dhe/ose telefon. Nëse fituesi nuk përgjigjet brenda 14 ditëve ose nuk plotëson kushtet, çmimi kalon te fituesi rezervë i radhës, sipas renditjes së publikuar paraprakisht. Çmimi nuk mund të këmbehet me para.

## 7. Të dhënat personale
Të dhënat tuaja përpunohen sipas Politikës së Privatësisë.

## 8. Kontakti
Për pyetje: {{contactEmail}} · {{contactPhone}}`,
  en: `## 1. Organiser
This giveaway is organised by **{{companyLegalName}}** ({{companyName}}), tax ID {{companyNipt}}, {{address}}.

## 2. Free entry
No purchase or payment is necessary to enter. A purchase does not increase the chances of winning.

## 3. Eligibility
Entrants must meet the eligibility requirements published on the giveaway page. Employees of the organiser and their immediate families may not enter unless stated otherwise.

## 4. How to enter
Complete the registration form during the giveaway period. **One entry per person** (the same e-mail address or phone number cannot be registered twice). Automated, duplicate or fraudulent entries will be declared invalid, with the reason recorded.

## 5. Winner selection
When registrations close, the list of valid entries is frozen and its SHA-256 hash is published. The winner is selected automatically using a future round of the public **drand** randomness beacon (League of Entropy), fixed before that randomness exists. Anyone can verify the result on the public verification page.

## 6. Notification and prize
The winner is contacted by e-mail and/or phone. If the winner does not respond within 14 days or is not eligible, the prize passes to the next alternate in the order published with the result. The prize cannot be exchanged for cash.

## 7. Personal data
Your personal data is processed according to the Privacy Policy.

## 8. Contact
Questions: {{contactEmail}} · {{contactPhone}}`,
};

export const DEFAULT_PRIVACY = {
  sq: `## Kontrolluesi i të dhënave
**{{companyLegalName}}** ({{companyName}}), NIPT {{companyNipt}}, {{address}}. Kontakt: {{contactEmail}}.

## Çfarë të dhënash mbledhim
Emrin e plotë, numrin e telefonit, adresën e email-it, qytetin (opsional), pëlqimet që jepni dhe të dhëna teknike minimale (burimi i kodit QR, koha e regjistrimit, një hash i pakthyeshëm i adresës IP për mbrojtje nga abuzimi). Nuk ruajmë adresën IP në formë të lexueshme.

## Pse i përpunojmë
- Për të administruar konkursin, për të kontaktuar fituesin dhe për të parandaluar mashtrimin (baza ligjore: zbatimi i kushteve të konkursit dhe interesi legjitim).
- Për marketing **vetëm** nëse jepni pëlqim të veçantë. Mund ta tërhiqni pëlqimin në çdo kohë.

## Sa kohë i ruajmë
Të dhënat ruhen për {{retentionDays}} ditë pas përfundimit të konkursit dhe më pas anonimizohen. Prova publike e shortit ruhet pa të dhëna personale.

## Kush i sheh
Vetëm stafi i autorizuar i organizatorit dhe ofruesit teknikë (hostimi, dërgimi i email-it) që veprojnë sipas udhëzimeve tona. Faqja publike e verifikimit nuk shfaq kurrë emra, email ose telefona.

## Të drejtat tuaja
Keni të drejtë të kërkoni qasje, korrigjim, fshirje, kufizim, kundërshtim dhe tërheqje të pëlqimit. Dërgoni kërkesën përmes formularit "Kërkesë për të dhënat" ose në {{contactEmail}}. Keni të drejtë të ankoheni pranë Komisionerit për të Drejtën e Informimit dhe Mbrojtjen e të Dhënave Personale (IDP).`,
  en: `## Data controller
**{{companyLegalName}}** ({{companyName}}), tax ID {{companyNipt}}, {{address}}. Contact: {{contactEmail}}.

## What we collect
Full name, phone number, e-mail address, city (optional), the consents you give and minimal technical data (QR source, registration time, an irreversible hash of your IP address for abuse prevention). We do not store your IP address in readable form.

## Why we process it
- To run the giveaway, contact the winner and prevent fraud (legal basis: performance of the giveaway terms and legitimate interest).
- For marketing **only** if you give separate consent. You can withdraw it at any time.

## Retention
Data is kept for {{retentionDays}} days after the giveaway ends and then anonymised. The public draw proof is kept without personal data.

## Who can see it
Only authorised staff of the organiser and technical providers (hosting, e-mail delivery) acting on our instructions. The public verification page never shows names, e-mails or phone numbers.

## Your rights
You may request access, rectification, erasure, restriction, objection and withdrawal of consent. Use the "Data request" form or write to {{contactEmail}}. You may lodge a complaint with the Albanian Information and Data Protection Commissioner (IDP).`,
};
