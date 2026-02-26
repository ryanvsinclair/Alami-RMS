import { expect, test } from "@playwright/test";
import { goAuthed, login } from "./helpers";

test("signup page renders", async ({ page }) => {
  await page.goto("/auth/signup");
  await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  await expect(page.getByLabel("Business name")).toBeVisible();
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
});

test("login works and dashboard renders", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Transactions")).toBeVisible();
});

test.describe("authenticated route smoke", () => {
  test("receive hub route shows all intake methods", async ({ page }) => {
    await goAuthed(page, "/receive");
    await expect(page.getByText("Scan Barcode")).toBeVisible();
    await expect(page.getByText("Scan Receipt")).toBeVisible();
    await expect(page.getByText("Photo Scan")).toBeVisible();
    await expect(page.getByText("Manual Entry")).toBeVisible();
  });

  test("receive barcode page loads", async ({ page }) => {
    await goAuthed(page, "/receive/barcode");
    await expect(page.getByLabel("Barcode")).toBeVisible();
    await expect(page.getByRole("button", { name: /look up/i })).toBeVisible();
  });

  test("receive photo page loads", async ({ page }) => {
    await goAuthed(page, "/receive/photo");
    await expect(
      page.getByText(/Take a photo of the product or type the label text/i)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /analyze product/i })).toBeVisible();
  });

  test("receive manual page loads", async ({ page }) => {
    await goAuthed(page, "/receive/manual");
    await expect(page.getByLabel("Search Items")).toBeVisible();
    await expect(page.getByRole("button", { name: /create new item/i })).toBeVisible();
  });

  test("receive receipt page loads input modes", async ({ page }) => {
    await goAuthed(page, "/receive/receipt");
    await expect(page.getByRole("button", { name: /camera \/ upload/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /paste text/i })).toBeVisible();
    await page.getByRole("button", { name: /paste text/i }).click();
    await expect(page.getByRole("button", { name: /parse receipt/i })).toBeVisible();
  });

  test("inventory list loads and detail opens when data exists", async ({ page }) => {
    await goAuthed(page, "/inventory");
    await expect(page.getByPlaceholder("Search inventory...")).toBeVisible();

    const emptyState = page.getByText(/No inventory items yet/i);
    if (await emptyState.isVisible().catch(() => false)) {
      test
        .info()
        .annotations.push({
          type: "note",
          description:
            "Inventory list was empty for the test account, so detail-page click smoke was skipped.",
        });
      return;
    }

    const firstClickableItemName = page.locator("div.cursor-pointer p.font-medium").first();
    await expect(firstClickableItemName).toBeVisible();
    await firstClickableItemName.click();
    await expect(page).toHaveURL(/\/inventory\/[^/]+$/);
    await expect(page.getByText("Details")).toBeVisible();
    await expect(page.getByText(/Recent Transactions/i)).toBeVisible();
  });

  test("contacts page loads and add form can open", async ({ page }) => {
    await goAuthed(page, "/contacts");
    const addButton = page.getByRole("button", { name: /^\+\s*add$/i });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
    }
    await expect(page.getByText(/New Contact/i)).toBeVisible();
    await expect(page.getByLabel("Name *")).toBeVisible();
  });

  test("staff page loads and invite form is visible", async ({ page }) => {
    await goAuthed(page, "/staff");
    await expect(page.getByText("Invite Staff")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /create invite link/i })).toBeVisible();
  });

  test("shopping page loads start or active session UI", async ({ page }) => {
    await goAuthed(page, "/shopping");
    await expect(
      page.getByText(/Start Shopping Session|Quick Shop \(Barcode\)|Scan Receipt/i)
    ).toBeVisible({ timeout: 20_000 });
  });

  test("receipt detail route opens when a dashboard receipt link exists", async ({ page }) => {
    await goAuthed(page, "/");
    const receiptLink = page.locator('a[href^="/receive/receipt/"]').first();
    if ((await receiptLink.count()) === 0) {
      test
        .info()
        .annotations.push({
          type: "note",
          description:
            "No receipt link was available on the dashboard for this test account, so receipt detail smoke was skipped.",
        });
      return;
    }

    await receiptLink.click();
    await expect(page).toHaveURL(/\/receive\/receipt\/[^/]+$/);
    await expect(page.getByText(/Digital|Photo|Receipt/i)).toBeVisible();
  });
});
