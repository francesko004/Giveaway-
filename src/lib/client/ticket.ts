"use client";

export interface TicketData {
  title: string;
  campaign: string;
  reference: string;
  holderLabel: string;
  holder: string;
  dateLabel: string;
  date: string;
  drawLabel: string;
  draw: string;
  company: string;
}

/** Draws the entry ticket to a PNG and triggers a download. */
export async function downloadTicket(d: TicketData) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  await document.fonts?.ready;
  const font = (w: number, s: number, mono = false) => `${w} ${s}px ${mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : '"Inter Variable", Inter, system-ui, sans-serif'}`;

  ctx.fillStyle = "#F5F7FA";
  ctx.fillRect(0, 0, W, H);

  // ticket body
  const x = 90, y = 110, w = W - 180, h = H - 220, r = 40, notchY = y + 560;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(20,36,58,0.18)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fill();
  ctx.restore();

  // header band
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, 260, [r, r, 0, 0]);
  const g = ctx.createLinearGradient(x, y, x + w, y + 260);
  g.addColorStop(0, "#2563EB");
  g.addColorStop(1, "#14243A");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = font(600, 30);
  ctx.fillText(d.company.toUpperCase(), x + 60, y + 90);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(800, 54);
  wrap(ctx, d.campaign, x + 60, y + 165, w - 120, 62, 2);

  // notches + perforation
  ctx.fillStyle = "#F5F7FA";
  for (const cx of [x, x + w]) {
    ctx.beginPath();
    ctx.arc(cx, notchY, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#D0D5DD";
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 50, notchY);
  ctx.lineTo(x + w - 50, notchY);
  ctx.stroke();
  ctx.setLineDash([]);

  // title + reference
  ctx.fillStyle = "#667085";
  ctx.font = font(600, 28);
  ctx.fillText(d.title.toUpperCase(), x + 60, y + 340);
  ctx.fillStyle = "#2563EB";
  ctx.font = font(800, 76, true);
  ctx.fillText(d.reference, x + 60, y + 440, w - 120);

  // details
  const rows: [string, string][] = [
    [d.holderLabel, d.holder],
    [d.dateLabel, d.date],
    [d.drawLabel, d.draw],
  ];
  let ry = notchY + 110;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#667085";
    ctx.font = font(500, 28);
    ctx.fillText(label, x + 60, ry);
    ctx.fillStyle = "#101828";
    ctx.font = font(700, 34);
    ctx.fillText(value, x + 60, ry + 46, w - 120);
    ry += 130;
  }

  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.reference}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh);
      line = word;
      if (++lines >= maxLines - 1) break;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + lines * lh, maxW);
}

/** Downloads an .ics calendar event for the draw date. */
export function downloadCalendar(opts: { title: string; start: string; url: string; description: string }) {
  const s = new Date(opts.start);
  const e = new Date(s.getTime() + 30 * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//giveaway//EN",
    "BEGIN:VEVENT",
    `UID:${fmt(s)}-${Math.random().toString(36).slice(2)}@giveaway`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(s)}`,
    `DTEND:${fmt(e)}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    `URL:${opts.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "giveaway-draw.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
