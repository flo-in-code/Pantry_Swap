const { defineConfig } = require("@playwright/test");
const { E2E_MONGO_URI, PORT } = require("./tests/e2e/constants.js");

module.exports = defineConfig({
    testDir: "./tests/e2e",
    globalSetup: "./tests/e2e/global-setup.js", //this file is run before all tests
    workers: 1, //run one test at a time
    retries: process.env.CI ? 1 : 0, //Github Actions retries failed test once; no retries if run locally
    reporter: process.env.CI ? [["html"], ["github"]] : "list", //CI - an HTML report on pr; locally - a simple list in the terminal
    use: {
        //test settings
        baseURL: `http://localhost:${PORT}`, // sets base URL so we can just write routes
        trace: "on-first-retry", //record step-by-step trace
    },
    webServer: {
        //playwright starts app before and stops it after running tests
        command: "node server.js",
        url: `http://localhost:${PORT}/Login`,
        reuseExistingServer: false, //always start a fresh server; if something else is using the same port, fail the tests
        env: {
            //test env variables handed to the local server instead of
            PORT: String(PORT),
            MONGO_URI: E2E_MONGO_URI,
            DYMO_API_KEY: "test", //placeholders so the email and validation clients can be created at startup (server.js)
            EMAIL_USER: "test@example.com",
            EMAIL_PASS: "test",
        },
    },
});
