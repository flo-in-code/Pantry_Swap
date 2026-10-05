const { test, expect } = require("@playwright/test");
const { login } = require("./helpers.js");
const { TEST_USER } = require("./constants.js");

test.beforeEach(async ({ page }) => {
    await login(page); //login through real login page
    await page.goto("/CreateListing");
    await expect(page.locator("#editLocation")).toHaveValue(`${TEST_USER.address}, ${TEST_USER.postalCode}, Canada`); //test profile address is 123 Main St
});

async function addFood(page, name, quantity) {
    await page.locator("#addFoodButton").click();
    await page.locator("#food-form input[name=name]").fill(name); //locates name=name attribute on the input element of the element with id=food-form, fills it
    await page.locator("#food-form input[name=quantity]").fill(quantity);
    await page.locator("#popup-card").getByRole("button", { name: "Add food" }).click();
}

test("creates a listing end to end", async ({ page }) => {
    await page.locator("#editTitle").fill("Test Bananas");
    await page.locator("#editPrice").fill("4"); //fill only accepts strings
    await page.locator("#editDescription").fill("Ripe and ready");
    await page.locator("#editProduce").check();
    await addFood(page, "Bananas", "6");
    await expect(page.locator("#foodsList")).toContainText("Bananas");

    await page.locator("#createButton").click();
    await expect(page.locator("#popup-card")).toContainText("Created!");
    await page.getByRole("button", {name: "OK"}).click();
    await expect(page).toHaveURL("/sell"); //redirects to sell at the end
});
