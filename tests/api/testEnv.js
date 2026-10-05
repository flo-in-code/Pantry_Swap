//should not use real .env file when testing
//giving dummy values so email and validation clients receive a dummy key
process.env.DYMO_API_KEY = "test";
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_PASS = "test";