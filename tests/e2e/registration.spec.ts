import { expect, test } from "@playwright/test";

const E2E = { slug: "e2e-giveaway", qrCode: "e2eqr01", admin: "e2e-admin@example.com", password: "E2e-admin-password-1" };

test.describe.configure({ mode: "serial" });

let reference = "";

test("complete registration journey from a QR scan (mobile)", async ({ page }) => {
  await page.goto(`/q/${E2E.qrCode}`);
  await expect(page).toHaveURL(new RegExp(`/giveaway/${E2E.slug}\\?src=poster01`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fito një biçikletë");
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByTestId("live-count")).toHaveText("0");

  // Step 1 — client-side validation blocks progress
  await expect(page.getByText("Hapi 1 nga 3")).toBeVisible();
  await page.getByRole("button", { name: "Vazhdo" }).click();
  await expect(page.getByText("Shkruani emrin dhe mbiemrin.")).toBeVisible();
  await page.getByLabel(/Emri dhe mbiemri/).fill("Arta Krasniqi");
  await page.getByLabel(/Qyteti/).fill("Durrës");
  await page.getByRole("button", { name: "Vazhdo" }).click();

  // Step 2
  await expect(page.getByText("Hapi 2 nga 3")).toBeVisible();
  await page.getByLabel(/Numri i telefonit/).fill("069 555 1234");
  await page.getByLabel(/^Email/).fill("arta.e2e@example.com");
  await page.getByRole("button", { name: "Vazhdo" }).click();

  // Step 3 — consents are required
  await expect(page.getByText("Hapi 3 nga 3")).toBeVisible();
  await page.getByRole("button", { name: "Dërgo regjistrimin" }).click();
  await expect(page.getByText("Duhet të pranoni kushtet e konkursit.")).toBeVisible();
  await page.locator("#acceptTerms").click();
  await page.locator("#acceptPrivacy").click();
  await page.locator("#ageConfirmed").click();
  await expect(page.locator("#marketingConsent")).not.toBeChecked(); // marketing consent is opt-in

  await page.getByRole("button", { name: "Dërgo regjistrimin" }).click();
  await expect(page.getByText("Regjistrimi u krye me sukses!")).toBeVisible();
  reference = (await page.getByTestId("reference-number").textContent()) ?? "";
  expect(reference).toMatch(/^GIVE-\d{4}-[0-9A-Z]{8}$/);
  await expect(page.getByTestId("entry-ticket")).toContainText("Fito një biçikletë");
  await expect(page.getByTestId("entry-ticket")).toContainText("Arta K.");
  await expect(page.getByText("1/4 të përfunduara")).toBeVisible();
  await expect(page.getByText(/nuk ndikojnë në shanse/)).toBeVisible();

  // Challenges: saving the ticket downloads a PNG and ticks the challenge
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Ruaj biletën" }).first().click()]);
  expect(download.suggestedFilename()).toBe(`${reference}.png`);
  await expect(page.getByText("2/4 të përfunduara")).toBeVisible();
});

test("duplicate registration is rejected with a clear message", async ({ page }) => {
  await page.goto(`/giveaway/${E2E.slug}`);
  await page.getByLabel(/Emri dhe mbiemri/).fill("Arta Krasniqi");
  await page.getByRole("button", { name: "Vazhdo" }).click();
  await page.getByLabel(/Numri i telefonit/).fill("+355 69 555 1234");
  await page.getByLabel(/^Email/).fill("someone.else@example.com");
  await page.getByRole("button", { name: "Vazhdo" }).click();
  await page.locator("#acceptTerms").click();
  await page.locator("#acceptPrivacy").click();
  await page.locator("#ageConfirmed").click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Dërgo regjistrimin" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "është regjistruar tashmë" })).toBeVisible();
});

test("language switcher shows English content", async ({ page }) => {
  await page.goto(`/giveaway/${E2E.slug}`);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Win an e-bike");
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("live counter reflects new entries", async ({ page }) => {
  await page.goto(`/giveaway/${E2E.slug}`);
  await expect(page.getByTestId("live-count")).toHaveText("1");
  await expect(page.getByText("+1 sot")).toBeVisible();
});

test("admin area is protected", async ({ page, request }) => {
  await page.goto("/admin/participants");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await request.get("/api/admin/participants/export");
  expect(res.status()).toBe(401);
});

test("admin sees the entry with its QR attribution", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(E2E.admin);
  await page.getByLabel("Password").fill(E2E.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/participants?q=${encodeURIComponent(reference)}`);
  const row = page.getByRole("row").filter({ hasText: reference });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Arta Krasniqi");
  await row.getByRole("link", { name: reference }).click();
  await expect(page.getByText("Poster E2E (src=poster01)")).toBeVisible();
  await expect(page.getByText("+355 69 555 1234")).toBeVisible();
});

test("public verification page is reachable and shows no personal data", async ({ page }) => {
  await page.goto(`/giveaway/${E2E.slug}`);
  await page.getByRole("link", { name: "Hap faqen e verifikimit" }).click();
  await expect(page.getByText("Shorti për këtë konkurs ende nuk është angazhuar.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Arta Krasniqi");
});
