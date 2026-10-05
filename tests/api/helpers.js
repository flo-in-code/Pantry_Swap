//mongodb-memory-server; set up MongoDB in memory instead of touching Atlas database
const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); //hasing password
const request = require("supertest"); // sends fake HTTP requests to the express app
const { MongoMemoryServer } = require("mongodb-memory-server"); //run temporary mongodb in memory

//fake user
const TEST_USER = {
    name: "Test User",
    email: "tester@example.com",
    password: "Password123!", //database stores the hashed version
};

let mongoTemp;

async function startDb() {
    mongoTemp = await MongoMemoryServer.create(); //creating a throwaway mongoDB inside memory
    await mongoose.connect(mongoTemp.getUri()); //connecting mongoose so server.js models can use this temp mongodb
}

async function stopDb() {
    await mongoose.disconnect();
    await mongoTemp.stop(); //stop the temp db and throw away data
}

//clear all models that exist
async function clearDb() {
    const { collections } = mongoose.connection;
    for (const name of Object.keys(collections)) {
        await collections[name].deleteMany({}); // {} empty filter matches everything, deleting all docs
    }
}

//make fake user to skip signup and OTP email verification
async function fakeUser() {
    return mongoose.model("Users").create({
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: await bcrypt.hash(TEST_USER.password, 10), //10 salt rounds in server.js
        tutorials: [],
    });
}

async function loginAgent(app) {
    const agent = request.agent(app); //create agent to save session cookies
    const res = await agent
        .post("/Login") // agent sends a login request to the app with the following email and password
        .send({ emailLogin: TEST_USER.email, passwordLogin: TEST_USER.password });
    if (res.status !== 302){
        throw new Error (`Login failed in test set up: ${res.status}`)
    }
    return agent;  //login response from server sent a server cookies that's been saved by the agent
}

//export functions to test files that need them
module.exports = {TEST_USER, startDb, stopDb, clearDb, fakeUser, loginAgent}
