//set up test db - resets contents and insert test data
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { E2E_MONGO_URI, TEST_USER } = require("./constants.js");

async function withDb(fn) {
    if (!(/e2e|test/i.test(E2E_MONGO_URI))) {
        throw new Error("Will not touch a database that doesn't look like a test database.");
    }
    await mongoose.connect(E2E_MONGO_URI); //connect to the test database
    try {
        return await fn(mongoose.connection.db); //run the work given
    } finally {
        await mongoose.disconnect(); //always disconnects at the end
    }
}

async function resetDb() {
    await withDb(async (db) => {
        await db.collection("users").deleteMany({});
        await db.collection("listings").deleteMany({});
        await db.collection("users").insertOne({
            //adding raw document to db
            name: TEST_USER.name,
            email: TEST_USER.email,
            password: await bcrypt.hash(TEST_USER.password, 10),
            phone: "604 123 4567",
            address: TEST_USER.address,
            postalCode: TEST_USER.postalCode,
            city: "vancouver",
            tutorials: ["create", "search"],
            savedItems: [],
            listedItems: [],
            notifications: [],
        });
    });
}

async function fakeListing() {
    return withDb(async (db) => {
        const user = await db.collection("users").findOne({ email: TEST_USER.email }); //find the test user so we can use their ID
        const { insertedId } = await db.collection("listings").insertOne({ //destructure MongoDB created listing id from the result object
            seller: String(user._id),
            title: "Seeded Apples",
            location: "123 Main St, Vancouver",
            price: 5,
            contact: "604 123 4567",
            description: "Surplus apples",
            category: ["Produce"],
            foods: [{ name: "Gala apples", quantity: 3 }],
            status: "listed",
        });
        return String(insertedId) //need string for URL
    });
}

module.exports = {resetDb, fakeListing}
