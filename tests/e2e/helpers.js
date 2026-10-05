//holds a browser action that several specs reuse

const { TEST_USER } = require("./constants.js");

async function login(page) {
    //page is the browser tab - playwright created
    await page.goto("/Login"); //open login page with base URL
    await page.locator("#emailLogin").fill(TEST_USER.email); //finds the element id=#emailLogin and types email into it
    await page.locator("#passwordLogin").fill(TEST_USER.password);
    await page.locator("#passwordLogin").press("Enter");
    await page.waitForURL("**/buy"); //wait for app to redirect to URL ending with /buy, meaning login worked
}

module.exports = {login}