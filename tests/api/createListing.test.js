const request = require("supertest"); //library that sends fake HTTP requests
const mongoose = require("mongoose"); //used for temp mongodb database
const app = require("../../server.js"); // this is the express app that was exported from server.js
const { TEST_USER, startDb, stopDb, clearDb, fakeUser, loginAgent } = require("./helpers.js"); 

const validListing = {
    title: "Fresh Apples",
    location: "123 Main St. Vancouver",
    price: 5,
    contact: "604 123 4567",
    description: "Extra apples from my tree",
    category: ["Produce"],
    foods: [{name: "Gala apples", quantity: 3}]
}

let user, agent; //declare in outer scope

beforeAll(startDb);
afterAll(stopDb);

beforeEach(async () => {
    await clearDb(); //clear all collections in db
    user = await fakeUser(); //create fake user in db
    agent = await loginAgent(app); //agent carries session cookie to remember the fake user
})

test("users cannot create listing without authentication", async() => {
    const res = await request(app).post("/createListing").send(validListing); //not using agent so no stored cookie
    expect(res.status).toBe(302); //302 means redirect
    expect(res.headers.location).toBe("/Login"); //the expected behaviour is to be redirected to login
});

test("create a listing returns 200 if successful", async () => {
    const res = await agent.post("/createListing").send(validListing);
    expect(res.status).toBe(200) //expected behaviour is the listing is saved successfully
})

test("a new listing is saved in the database", async () => {
    const res = await agent.post("/createListing").send(validListing);
    const Listing = mongoose.model("Listings");
    const count = await Listing.countDocuments();
    const saved = await Listing.findOne({title: "Fresh Apples"});
    expect(count).toBe(1);
    expect(saved.title).toEqual(validListing.title);
})

