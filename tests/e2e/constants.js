module.exports = {
    E2E_MONGO_URI: process.env.E2E_MONGO_URI || "mongodb://127.0.0.1:27017/pantryswap_test", //db running locally on port 27017 for playwright
    PORT: 3100, //different from dev server, 3000
    TEST_USER: {
        name: "Test User",
        email: "tester@example.com",
        password: "Password123!",
        address: "123 Main St",
        postalCode: "V6B 1A1"
    }
}

