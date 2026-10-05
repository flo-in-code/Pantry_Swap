const { test, expect } = require("@playwright/test");
const { login } = require("./helpers.js");
const { fakeListing } = require("./db.js");
const { TEST_USER } = require("./constants.js");

let listingId;

test.beforeEach(async ({ page }) => {
    listingId = await fakeListing(); //inserts a fake listing in to the temp db
    await login(page);
    await page.goto(`/EditListing/${listingId}`);
});

test("editListing page pre-fills form saved listings", async ({ page }) => {
    await expect(page.locator("#editTitle")).toHaveValue("Seeded Apples");
    await expect(page.locator("#editProduce")).toBeChecked();
    await expect(page.locator("#editDairy")).not.toBeChecked();
    await expect(page.locator("#foodsList")).toContainText("Gala apples");
    await expect(page.locator("#statusLabel")).toHaveText("Listed");
});