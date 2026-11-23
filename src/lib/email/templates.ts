type Locale = "sq" | "en";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(company: string, title: string, body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#F5F7FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#101828">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4E7EC;border-radius:16px">
<tr><td style="padding:24px 28px;border-bottom:1px solid #E4E7EC;font-weight:700;font-size:18px;color:#14243A">${esc(company)}</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:22px;color:#14243A">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #E4E7EC;font-size:12px;color:#667085">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${s}</p>`;
const ref = (s: string) =>
  `<div style="margin:18px 0;padding:16px;border-radius:12px;background:#F5F7FA;border:1px dashed #2563EB;text-align:center;font-size:20px;font-weight:700;letter-spacing:1px;color:#2563EB">${esc(s)}</div>`;
const btn = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#2563EB;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

export interface BaseVars {
  company: string;
  campaignTitle: string;
  locale: Locale;
}

export function registrationConfirmation(v: BaseVars & { fullName: string; reference: string; registeredAt: string; drawDate: string; url: string }) {
  const sq = v.locale === "sq";
  const subject = sq ? `Regjistrimi u krye – ${v.campaignTitle}` : `You're registered – ${v.campaignTitle}`;
  const body =
    p(sq ? `Përshëndetje ${esc(v.fullName)},` : `Hi ${esc(v.fullName)},`) +
    p(sq ? `Regjistrimi juaj në <strong>${esc(v.campaignTitle)}</strong> u krye me sukses.` : `Your entry to <strong>${esc(v.campaignTitle)}</strong> was successful.`) +
    p(sq ? "Numri juaj i pjesëmarrjes:" : "Your participation reference:") +
    ref(v.reference) +
    p(sq ? `Regjistruar më: ${esc(v.registeredAt)}<br>Shorti: ${esc(v.drawDate)}` : `Registered: ${esc(v.registeredAt)}<br>Draw: ${esc(v.drawDate)}`) +
    btn(v.url, sq ? "Shiko konkursin" : "View giveaway");
  const footer = sq
    ? "Pjesëmarrja është falas. Nuk do t'ju kërkojmë kurrë pagesë ose fjalëkalime. Ruajeni këtë email si provë regjistrimi."
    : "Entry is free. We will never ask you for payment or passwords. Keep this e-mail as proof of registration.";
  return { subject, html: layout(v.company, sq ? "Faleminderit për pjesëmarrjen!" : "Thanks for entering!", body, footer) };
}

export function winnerNotification(v: BaseVars & { fullName: string; reference: string; verifyUrl: string; contactEmail: string; contactPhone: string }) {
  const sq = v.locale === "sq";
  const subject = sq ? `Urime! Jeni fitues – ${v.campaignTitle}` : `Congratulations, you won – ${v.campaignTitle}`;
  const body =
    p(sq ? `Përshëndetje ${esc(v.fullName)},` : `Hi ${esc(v.fullName)},`) +
    p(sq ? `Numri juaj i pjesëmarrjes u përzgjodh fitues në <strong>${esc(v.campaignTitle)}</strong>.` : `Your entry was selected as the winner of <strong>${esc(v.campaignTitle)}</strong>.`) +
    ref(v.reference) +
    p(sq ? `Do t'ju kontaktojmë për marrjen e çmimit. Mund të na shkruani në ${esc(v.contactEmail)} ose të telefononi ${esc(v.contactPhone)}.` : `We will contact you to arrange the prize. You can also reach us at ${esc(v.contactEmail)} or ${esc(v.contactPhone)}.`) +
    btn(v.verifyUrl, sq ? "Verifiko rezultatin" : "Verify the result");
  const footer = sq ? "Kujdes nga mashtrimet: nuk kërkojmë kurrë pagesë për të marrë një çmim." : "Beware of scams: we never ask for payment to claim a prize.";
  return { subject, html: layout(v.company, sq ? "Urime!" : "Congratulations!", body, footer) };
}

export function campaignClosed(v: BaseVars & { entries: number; adminUrl: string }) {
  const subject = `[Admin] Registrations closed – ${v.campaignTitle}`;
  const body =
    p(`Registrations for <strong>${esc(v.campaignTitle)}</strong> are now closed with <strong>${v.entries}</strong> entries.`) +
    p("Next: review flagged entries, then freeze the entry list and publish the draw commitment.") +
    btn(v.adminUrl, "Open draw console");
  return { subject, html: layout(v.company, "Registrations closed", body, "Automatic notification from the giveaway platform.") };
}

export function drawResult(v: BaseVars & { reference: string; verifyUrl: string; round: number; snapshotHash: string }) {
  const subject = `[Admin] Draw completed – ${v.campaignTitle}`;
  const body =
    p(`The draw for <strong>${esc(v.campaignTitle)}</strong> is complete.`) +
    p(`Winning reference:`) +
    ref(v.reference) +
    p(`drand round ${v.round}<br>Snapshot SHA-256: <code style="font-size:12px;word-break:break-all">${esc(v.snapshotHash)}</code>`) +
    btn(v.verifyUrl, "Public verification page");
  return { subject, html: layout(v.company, "Draw result", body, "Automatic notification from the giveaway platform.") };
}
