const request = require("supertest");
const mongoose = require("mongoose"); //used for temp mongodb database
const app = require("../../server.js"); // this is the express app that was exported from server.js
const { TEST_USER, startDb, stopDb, clearDb, fakeUser, loginAgent } = require("./helpers.js");

let user, agent, listing;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
    await clearDb();
    user = await fakeUser();
    agent = await loginAgent(app);
    listing = await mongoose.model("Listings").create({
        seller: String(user._id),
        title: "Juicy Apples",
        price: 5,
        location: "123 Main St",
        contact: "604 123 4567",
        category: ["Produce"],
        foods: [{ name: "Gala apples", quantity: 3 }],
    });
});

test("users cannot update a listing without authentication", async () => {
    const res = await request(app).put(`/EditListing/${listing._id}`).send({ updatedTitle: "New Title" });
    expect(res.status).toBe(302);
    expect(res.header.location).toBe("/Login");
});

test("editing title will update to new title", async () => {
    const res = await agent.put(`/EditListing/${listing._id}`).send({ updatedTitle: "Fresh Juicy Apples" });
    expect(res.status).toBe(200);

    const saved = await mongoose.model("Listings").findOne({ title: "Fresh Juicy Apples" });
    expect(saved.title).toBe("Fresh Juicy Apples");
});

test("deleting a listing marks status as deleted", async () => {
    const res = await agent.put(`/DeleteListing/${listing._id}`);
    expect(res.status).toBe(200);

    const softDeletedListing = await mongoose.model("Listings").findById(listing._id);
    expect(softDeletedListing.status).toEqual("deleted");
});
