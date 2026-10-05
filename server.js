// MONGO set up
require("dotenv").config();
const port = process.env.PORT || 5000;
const db = process.env.MONGO_URI;
const secret = process.env.SESSION_SECRET;

// nodemailer for sending OTP emails via Gmail
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//setting up dymo for email validation - pulled from dymo documentation
const DymoAPI = require("dymo-api");
const dymoClient = new DymoAPI({
  apiKey: process.env.DYMO_API_KEY,
  rules: {
    email: {
      deny: ["FRAUD", "INVALID", "NO_MX_RECORDS", "NO_REPLY_EMAIL"],
    },
  },
});

// storing sessions in a file
var session = require("express-session");
const FileStore = require("session-file-store")(session);

// bcrypt
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10; // How strong the hashing should be

const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");

// multer
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "50mb" }));
app.use(express.static("src"));
app.use(express.static("."));

// schema for images
const ImageSchema = new mongoose.Schema({
  name: String,
  image: Buffer,
});

// schema for users
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  password: String,
  city: String,
  address: String,
  postalCode: String,
  profilePicture: String,
  savedItems: [String], // the idea is to store _id of documents in listedItems here
  listedItems: [String], // the idea is to store _id of documents in listedItems here
  notifications: [
    {
      notifType: String, // type of the lsiting found in notificationSystem.js
      hasSeen: Boolean,
      listing: String, // _id of the related listing
      createdAt: { type: Date, default: Date.now }, // create a timestamp like (X hours ago)
    },
  ],
  tutorials: [String],
  easterEgg: Boolean,
});

// schema of listings
const ListingsSchema = new mongoose.Schema({
  seller: String, // assigning _id from userSchema here
  image: String,
  title: String,
  price: Number,
  location: String,
  contact: String,
  description: String,
  category: {
    type: [
      {
        type: String,
        enum: ["Produce", "Meat", "Dairy", "Cooked Meals", "Baked Goods"],
      },
    ],
    required: true,
  },
  foods: [{ name: String, quantity: Number }],
  status: {
    type: String,
    enum: ["listed", "unlisted", "deleted"],
    default: "listed",
    required: true,
  },
});

//schema of review collection
const reviewsSchema = new mongoose.Schema({
  reviewer: String, // user ID of the writer
  reviewerName: String, // display name of the writer
  seller: String, // user ID of the seller
  title: String,
  rating: Number,
  description: String,
  listing: String, // listing ID
  createdAt: { type: Date, default: Date.now },
});

const ImageModel = mongoose.model("Images", ImageSchema);

const UserModel = mongoose.model("Users", UserSchema);

const ListingModel = mongoose.model("Listings", ListingsSchema);

const ReviewModel = mongoose.model("Reviews", reviewsSchema);

// setting up session
app.use(
  session({
    store: new FileStore({
      path: "./sessions",
      secret: "keyboard cat", // optional to encrypt the session data
      retries: 1,
    }),
    secret: "my secret key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, // 1 hour
  }),
);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

if (require.main === module) {
  main().catch((err) => console.log(err));
}
module.exports = app;

async function main() {
  mongoose
    .connect(db)
    .then(() => {
      console.log("Connected to MongoDB");
      app.listen(port, () => {
        console.log("Server running on port 3000");
      });
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
    });
}

// home route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

// Login routes

app.get("/Login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.post("/Login", async (req, res) => {
  try {
    const user = await UserModel.findOne({ email: req.body.emailLogin });

    // check if user with that email address exists
    if (user) {
      const PasswordMatched = await bcrypt.compare(
        req.body.passwordLogin,
        user.password,
      );

      // check if password matched set up the session
      if (PasswordMatched) {
        req.session.email = req.body.emailLogin;
        req.session.UserID = user._id;

        if (req.body.RememberLogin) {
          // we can keep the cookie if remember me checked for 2 weeks in milliseconds
          req.session.cookie.maxAge = 14 * 24 * 3600 * 1000;
        }
        //makes the redirect wait until the session is fully written to session file, because other routes like
        // user were still loading the previous user who was logged in
        // redirecting would be trigger without setting the session properly without this

        req.session.save(() => res.redirect("/buy"));
      }
      // if password doesnt match
      else res.status(401).json({ error: "Invalid credentials" });
    }
    // if user email doesnt exist in the DB
    else res.status(401).json({ error: "Invalid credentials" });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// send OTP route — used by signup form
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim())
    return res.status(400).json({ error: "Email is required." });

  // check if email is already registered before sending OTP
  const emailExists = await UserModel.findOne({ email });
  if (emailExists)
    return res.status(400).json({ error: "There's an account associated with this email!" });

  // validate email with dymo before sending
  try {
    const decision = await dymoClient.isValidEmail(email);
    if (!decision.allow)
      return res.status(400).json({ error: "Please use a valid email address." });
  } catch (error) {
    // dymo API failed, fail open
    console.log(error)
  }

  // generate a 6-digit OTP and save it to session with a 2-minute expiry
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  //sessions work for non logged in users as well
  req.session.otp = { code: otp, expiry: Date.now() + 2 * 60 * 1000, email };

  // send the OTP email via Gmail
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Pantry Swap verification code",
      html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 2 minutes.</p>`,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send verification email." });
  }
});

// verify OTP route — checks the code and sets a verified flag in session
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const sessionOtp = req.session.otp;

  if (!sessionOtp) return res.status(400).json({ error: "Please request a verification code first." });
  if (Date.now() > sessionOtp.expiry) return res.status(400).json({ error: "Verification code has expired." });
  if (sessionOtp.email !== email) return res.status(400).json({ error: "Email does not match the one the code was sent to." });
  if (sessionOtp.code !== otp) return res.status(400).json({ error: "Incorrect verification code." });

  // mark email as verified in session and clear the OTP
  req.session.otpVerified = email;
  delete req.session.otp;

  res.json({ success: true });
});

// signup route

app.post("/SignUp", async (req, res) => {
  const NewUserEmail = req.body.emailSignup;
  const NewUserName = req.body.name;
  const NewUserPassword = req.body.passwordSignup;

  if (
    !NewUserPassword ||
    !NewUserPassword.trim() ||
    !NewUserEmail ||
    !NewUserEmail.trim() ||
    !NewUserName ||
    !NewUserName.trim()
  ) {
    return res.status(400).json({ error: "Please fill out all the fields!" });
  }

  // check that this email was verified via OTP before allowing signup
  if (req.session.otpVerified !== NewUserEmail)
    return res.status(400).json({ error: "Please verify your email first." });

  delete req.session.otpVerified;

  // create a new user in DB
  try {
    const HashedPassword = await bcrypt.hash(NewUserPassword, SALT_ROUNDS);
    const user = await UserModel.create({
      name: NewUserName,
      password: HashedPassword,
      email: NewUserEmail,
      tutorials: [],
    });

    // setting up the session for the new user
    req.session.email = NewUserEmail;
    req.session.UserID = user._id;

    if (req.body.RememberSignup) {
      // we can keep the cookie if remember me checked for 2 weeks in milliseconds
      req.session.cookie.maxAge = 14 * 24 * 3600 * 1000;
    }
    //makes the redirect wait until the session is fully written to session file, because other routes like
    // user were still loading the previous user who was logged in.
    // redirecting would be trigger without setting the session properly without this

    req.session.save(() => res.redirect("/buy"));
  } catch (error) {
    res.status(500).json({ error: "registration failed" });
  }
});


// setting up a middleware to protect the following routes for non-logged in users

function isAuthenticated(req, res, next) {
  if (req.session.UserID) next();
  else res.redirect("/Login");
}

// logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out.");
    }
    res.redirect("/Login");
  });
});

// ==================================================================
// any route that needs protection for non-logged in users goes after this line
// ==================================================================

app.use(isAuthenticated);

// get route for sending back user information for account page
app.get("/Account", async (req, res) => {
  try {
    res.sendFile(__dirname + "/account.html");
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error!" });
  }
});

app.get("/AccountData", async (req, res) => {
  try {
    const Data = await UserModel.findById({ _id: req.session.UserID });
    res.json(Data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error!" });
  }
});

// put route to update the user document in the DB from the Account page
app.put("/ChangeData", async (req, res) => {
  try {
    const UserNewName = req.body.UserNewName;
    const UserNewEmail = req.body.UserNewEmail;
    const UserNewphone = req.body.UserNewphone;
    const UserNewCity = req.body.UserNewCity;
    const UserNewPFP = req.body.UserNewPFP;
    const UserNewAddress = req.body.UserNewAddress;
    const UserNewPostalCode = req.body.UserNewPostalCode;
    const UserEasterEgg = req.body.seenEasterEgg;

    // check if the value exists, if so, update the DB
    const UpdatedFields = {};
    // use the exact same names in the DB to add the corresponding values to in the dictionary
    if (UserNewName) UpdatedFields.name = UserNewName;
    if (UserNewEmail) UpdatedFields.email = UserNewEmail;
    if (UserNewphone) UpdatedFields.phone = UserNewphone;
    if (UserNewCity) UpdatedFields.city = UserNewCity;
    if (UserNewPFP) UpdatedFields.profilePicture = UserNewPFP;
    if (UserNewAddress) UpdatedFields.address = UserNewAddress;
    if (UserNewPostalCode) UpdatedFields.postalCode = UserNewPostalCode;
    if (UserEasterEgg) UpdatedFields.easterEgg = UserEasterEgg;

    const user = await UserModel.findByIdAndUpdate(
      { _id: req.session.UserID },
      { $set: UpdatedFields },
    );
    res.json({ message: "Updated Successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// add a route to delete an account
app.delete("/DeleteAccount", async (req, res) => {
  try {
    await UserModel.findByIdAndDelete({ _id: req.session.UserID });
    req.session.destroy(() => res.send("Account deleted!"));
  } catch (error) {
    res.status(500).send("Delete failed!");
  }
});

// ==================================================================
// Routes for Create/Edit Listing
// ==================================================================
//serve the edit listing page
app.get("/EditListing/:listingID", (req, res) => {
  res.render("editListingPage.ejs");
});

//load one listing
app.get("/LoadListing/:listingID", async (req, res) => {
  const listingID = req.params.listingID;
  try {
    const listingRecord = await ListingModel.findOne({ _id: listingID });
    res.status(200).send(listingRecord);
  } catch (error) {
    res.status(500).send("Could not load listing");
  }
});

//Save Listing route
app.put("/EditListing/:listingID", async (req, res) => {
  const listingID = req.params.listingID;
  const {
    updatedImage,
    updatedTitle,
    updatedLocation,
    updatedPrice,
    updatedContact,
    updatedDescription,
    updatedCategory,
    updatedFoods,
  } = req.body;
  try {
    const listingRecord = await ListingModel.findOne({ _id: listingID });

    if (updatedImage) listingRecord.image = updatedImage;
    if (updatedTitle) listingRecord.title = updatedTitle;
    if (updatedLocation) listingRecord.location = updatedLocation;
    if (updatedPrice) listingRecord.price = updatedPrice;
    if (updatedContact) listingRecord.contact = updatedContact;
    if (updatedDescription) listingRecord.description = updatedDescription;
    if (updatedCategory) listingRecord.category = updatedCategory;
    if (updatedFoods) listingRecord.foods = updatedFoods;
    if (updatedImage) listingRecord.image = updatedImage;

    await listingRecord.save();
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Edit listing form could not be saved.");
  }
});

//delete listing route - soft deleting only
app.put("/DeleteListing/:listingID", async (req, res) => {
  const listingID = req.params.listingID;
  try {
    const listingRecord = await ListingModel.findOne({ _id: listingID });
    listingRecord.status = "deleted";
    await listingRecord.save();
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Listing could not be deleted.");
  }
});

//Unlist Listing route
app.put("/UpdateListingStatus/:listingID", async (req, res) => {
  const listingID = req.params.listingID;
  const { buttonValue } = req.body;
  try {
    const listingRecord = await ListingModel.findOne({ _id: listingID });

    if (buttonValue == "Unlist") {
      listingRecord.status = "unlisted";
      await listingRecord.save();
      res.sendStatus(200);
    } else if (buttonValue == "Re-list") {
      listingRecord.status = "listed";
      await listingRecord.save();
      res.sendStatus(200);
    }
  } catch (error) {
    res.status(500).send("Could not update listing status");
  }
});

// Serves the create listing page
app.get("/CreateListing", async (req, res) => {
  res.render("createListingPage.ejs");
});

app.get("/test", (req, res) => {
  res.render("test.ejs");
});

//Create listing route
app.post("/CreateListing", async (req, res) => {
  const {
    image,
    title,
    location,
    price,
    contact,
    description,
    category,
    foods,
  } = req.body;
  try {
    const newListing = await ListingModel.create({
      seller: req.session.UserID,
      image: image,
      title: title,
      location: location,
      price: price,
      contact: contact,
      description: description,
      category: category,
      foods: foods,
    });

    await UserModel.findByIdAndUpdate(
      req.session.UserID,
      { $push: { listedItems: newListing._id } },
      { new: true },
    );
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Create listing form could not be saved.");
  }
});

app.get("/sell", (req, res) => {
  res.render("sellListings.ejs");
});

app.get("/buy", (req, res) => {
  res.render("buyListings.ejs");
});

app.get("/sellerListings", async (req, res) => {
  try {
    const listings = await ListingModel.find({ seller: req.session.UserID });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/loadListings", async (req, res) => {
  let filter = {};
  try {
    const listings = await ListingModel.find(filter);
    if (listings.length == 0) return res.status(404).send("No listings found.");
    res.send(listings);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

//get current user info
app.get("/user", async (req, res) => {
  try {
    if (!req.session.UserID) {
      return res.status(401).json({
        error: "No session",
      });
    }

    const currentUser = await UserModel.findById(req.session.UserID);

    if (!currentUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(currentUser);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/allUsers", async (req, res) => {
  try {
    const allUsers = await UserModel.find({});
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.put("/addUserNotification/:id", async (req, res) => {
  try {
    const reciever = req.params.id;
    const updatedUserInfo = await UserModel.findByIdAndUpdate(
      { _id: reciever },
      { $addToSet: { notifications: req.body.newNotif } },
      { new: true }, // this line is needed to get the updated version and not the old one
    );
    res.json(updatedUserInfo.notifications);
  } catch (error) {
    res.status(500).send("Unexpected server error!");
  }
});

// Add completed tutorial to user
app.put("/addUserTutorial/:id", async (req, res) => {
  try {
    const { tutorialName } = req.body;
    const updatedUser = await UserModel.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: {
          tutorials: tutorialName,
        },
      },
      { new: true },
    );
    res.json(updatedUser.tutorials);
  } catch (error) {
    res.status(500).send("Unexpected server error!");
  }
});

//update user
app.put("/updateUser/:id", async (req, res) => {
  try {
    const updateFields = {};

    if (req.body?.tutorials !== undefined) {
      updateFields.tutorials = req.body.tutorials;
    }

    if (req.body?.notifications !== undefined) {
      updateFields.notifications = req.body.notifications;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        error: "No valid fields provided for update",
      });
    }

    const updated = await UserModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// get the bookmark or saved page
app.get("/bookmark", (req, res) => {
  res.sendFile(__dirname + "/savedPage.html");
});

// save a listing into users savedItems
// addToSet add an element to array if it doesnt exist in it already, ensures avoiding duplicates
app.post("/bookmarkListing/:id", async (req, res) => {
  try {
    const bookmarkedItem = req.params.id;
    const updatedUserInfo = await UserModel.findByIdAndUpdate(
      { _id: req.session.UserID },
      { $addToSet: { savedItems: bookmarkedItem } },
      { new: true }, // this line is needed to get the updated version and not the old one
    );
    res.json(updatedUserInfo.savedItems);
  } catch (error) {
    res.status(500).send("Unexpected server error!");
  }
});

// delete a listing from savedItems
app.post("/removeBookmark/:id", async (req, res) => {
  try {
    const unBookmarkedItem = req.params.id;
    const updatedUserInfo = await UserModel.findByIdAndUpdate(
      { _id: req.session.UserID },
      { $pull: { savedItems: unBookmarkedItem } },
      { new: true }, // this line is needed to get the updated version and not the old one
    );
    res.json(updatedUserInfo.savedItems);
  } catch (error) {
    res.status(500).send("Unexpected server error!");
  }
});

// ============================================================================================
// This function extracts only the street name of the listing to show it on the details page
// to avoid exposing the full address for privacy concerns.
// this is used in the following route.
// ============================================================================================
function extractStreet(location) {
  //recover in case there is no location in the database
  if (!location) return "Address not provided!";

  // split by comma, take the street segment and trim whitespace
  const streetPart = location.split(",")[0].trim();

  // split into words
  const tokens = streetPart.split(" ");

  // drop the first word/numeric part
  // isNaN means is not a number
  const firstIsNumber = !isNaN(Number(tokens[0]));

  //if the first part is true, slice it and join the rest to reform a string
  const street = firstIsNumber ? tokens.slice(1).join(" ") : streetPart;

  // recover if the extraction leaves us with nothing(null), fall back to full address in worst case scenario
  return street || location;
}

// routes for rendering listing details page and loading it dynamically
app.get("/listingDetails/:id", async (req, res) => {
  try {
    const listing = await ListingModel.findById(req.params.id);
    if (!listing) {
      return res.status(404).send("Listing not found");
    }
    const user = await UserModel.findById(listing.seller, {
      city: 1,
      name: 1,
      profilePicture: 1,
      phone: 1,
    });

    res.render("listingDetails", {
      listing,
      user,
      street: extractStreet(listing.location),
    });
  } catch (error) {
    res.status(500).send("Unexpected server error!");
  }
});

// route to post reviews
app.post("/reviews/:id", async (req, res) => {
  try {
    const listingID = req.params.id;
    const listing = await ListingModel.findById(listingID, { seller: 1 });
    const reviewer = req.session.UserID;
    const { title, description, rating, name } = req.body;
    await ReviewModel.create({
      listing: listingID,
      seller: listing.seller, // extract the seller ID string from the document
      reviewer: reviewer,
      title: title,
      description: description,
      rating: rating,
      reviewerName: name,
    });
    res.send("Review added successfully!");
  } catch (error) {
    res.status(500).json({ error: "Could not save review" });
  }
});

//route to get all reviews for the seller
app.get("/sellerReviews/:id", async (req, res) => {
  try {
    const listing = await ListingModel.findById(req.params.id);
    const sellerReviews = await ReviewModel.find({ seller: listing.seller });
    res.json(sellerReviews);
  } catch (error) {
    res.status(500).json({ error: "Could not get reviews" });
  }
});

//===================================================================================================
//This route handles connection to gemini to fill out the create listing form for the user
// Generated by Gemini
// only systemPrompt is mostly written by me, with some help from gemini to have the proper structure, and
// make sure it wont break
// @author https://gemini.google.com/
//===================================================================================================
app.post("/api/chat", async (req, res) => {
  // Receive history from the frontend
  const { message, formData, history } = req.body;

  try {
    const user = await UserModel.findById(req.session.UserID);
    const userPhone = user?.phone || "not set";
    // /\D/g replaces any non-digit element with empty string and then extract last 4 digits
    const last4 =
      userPhone !== "not set" ? userPhone.replace(/\D/g, "").slice(-4) : "XXXX";

    // permanent instructions for behavior
    const systemRules = `
You are the "Pantry Swap Assistant," a helpful guide for creating food surplus listings on a Canadian marketplace. You follow a strict, numbered conversation flow internally, but the conversation should always feel natural and friendly — never robotic or like a checklist being read aloud.

---
### CURRENT CONTEXT
- User phone on file: [USER_PHONE]
- Current form state: provided by the user at the start of each message inside [Current Form State: ...]

---
### THE 8-STEP FLOW (follow in exact order, never announce step numbers out loud)

**STEP 1 — COLLECT FOOD ITEMS**
Ask the user what food items they want to list.
- Only accept food items. Politely reject non-food items and ask again.
- If the user lists items but omits quantities for any of them, ask for the missing quantities before moving on. Ask for all missing quantities in a single message.
- **Handling weights and volumes:** When a user gives a weight or volume (e.g. "2 pounds of apples", "4 lbs of meat", "500g of cheese"), store the unit in the food name and set quantity to the count of units. Example: "2 pounds of apples" → name="apples 2 lbs", quantity=1. "three 500g packs of ground beef" → name="ground beef 500g", quantity=3.
- **Vague pack quantities:** If the user says something like "2 packs of ground beef" without specifying the weight per pack, ask: "How much does each pack weigh? (e.g. 500g, 1 lb)" — you need this to price accurately. Do not move on until you have the weight.
- **Bulk weight without a unit count:** If the user gives only a total weight with no indication of how many packages (e.g. "4 pounds of meat"), ask: "Is that one package of 4 lbs, or multiple smaller packages?" to clarify before recording it.
- Once every item has a confirmed name and a clear, priceable quantity, acknowledge and move to STEP 2.

**STEP 2 — COLLECT LOCATION**
First, check the location field in [Current Form State]:
- If it already matches the required format (e.g., "123 Main St, V5K 1A2, Canada"), confirm it with the user: "I see your address is already filled in as [address]. Does that work for this listing?" Wait for confirmation, then move to STEP 3.
- If it contains enough information to build a valid address (street number, street name, and a Canadian postal code — in any format or order), silently convert it to the required format: "[Street Number] [Street Name], [POSTAL CODE], Canada". Always separate each part with a comma and a space. If a city or province is included, silently omit it. If the user did not include a comma, add it yourself. A Canadian postal code (letter-digit-letter space digit-letter-digit, e.g. V5K 1A2) always implies Canada — never ask the user to confirm the country. Do not mention any of these formatting corrections to the user. Confirm with the user: "I've formatted your address as [converted address] — does that look right?"
- If it looks like just a city, neighbourhood, or partial address with no postal code, say: "I need a full address to complete the listing. Could you provide your street address and postal code? (e.g., 123 Main St, V5K 1A2)"
- If it is empty, ask: "What is the pickup address for this listing? Please use this format: 123 Main St, V5K 1A2"
- A valid address MUST contain: a street number (digits), a street name, and a Canadian postal code (letter-digit-letter space digit-letter-digit, e.g. V5K 1A2).
- The final stored format is ALWAYS: [Street Number] [Street Name], [POSTAL CODE], Canada — three parts, comma-separated, nothing else. Never store the address without ", Canada" at the end.
- Reject anything missing a street number or a valid Canadian postal code. Explain the exact format needed and ask again.
- Do NOT accept suite/unit numbers in place of a street address.
- Do NOT suggest a price until a valid address is confirmed.
- Once a valid address is confirmed, move to STEP 3.

**STEP 3 — SUGGEST PRICE**
Suggest a price in CAD using this logic:
  a) Start from estimated Canadian retail price for each item.
  b) Apply a 40–60% surplus discount (use 45% as your default).
  c) Compare the total against local Facebook Marketplace, too good to go, and Kijiji norms for similar surplus bundles.
  d) Only use $3.99–$7.99 CAD as a sanity check if ALL items are everyday low-value 
   staples (e.g., bread, common produce, a single egg, condiments). Do NOT apply 
   this cap if the bundle contains any of the following: meat, seafood, dairy packs, 
   prepared/cooked meals, baked goods from a bakery, or any item whose individual 
   retail price exceeds $5.00 CAD.
  e) Hard limits: the minimum price for any listing is $1.00 CAD. The maximum price for surplus bundles is $25.00 CAD unless the items have clearly high retail value (e.g., premium cuts of meat).
  f) Present your suggested price and explain the reasoning by showing:
   - Your estimated retail price per item (e.g., "ground beef ~$8/pack × 3 = $24 CAD")
   - The discount applied and the resulting total
   - Round to the nearest $0.50 for a clean number
   Never summarize with just "roughly X% off typical retail." Always show the 
   per-item estimates so the user can follow your logic.
  g) Ask: "Does this price work for you, or would you like to adjust it?"
- If the user asks to adjust, accept their number or negotiate once, then confirm the final price.
- Once a price is confirmed, move to STEP 4.

**STEP 4 — COLLECT CONTACT (PHONE ONLY)**
Contact rules:
  - If [USER_PHONE] is NOT "not set": say "I have a phone number on file ending in [LAST_4] — would you like to use that for this listing, or would you prefer to use a different one?"  Wait for confirmation before proceeding.
  - If [USER_PHONE] IS "not set": ask "What phone number should buyers use to contact you?"
- Only accept a 10-digit phone number (Canadian format). Reject emails, social media handles, or any non-phone contact. Explain the restriction and ask again if needed.
- If the user says "skip," acknowledge it and move to STEP 5 without a contact number.
- Once a phone number is confirmed or skipped, move to STEP 5.

**STEP 5 — OFFER TITLE, DESCRIPTION & CATEGORY SUGGESTIONS**
Say: "Great! I can also draft a Title, Description, and Categories for your listing to help it stand out. Want me to show you my suggestions?"
- Wait for the user to respond before doing anything else.
- If yes, move to STEP 6.
- If no or skip, move to STEP 7 with those fields left as-is from the current form state.

**STEP 6 — SHOW SUGGESTIONS**
Present your suggestions as a clean summary:
  * **Title:** [Suggested Title — specific, appealing, includes key items]
  * **Description:** [2–3 sentences: what's included, condition/freshness, pickup info]
  * **Categories:** [Pick only from: Produce, Meat, Dairy, Cooked Meals, Baked Goods]

Ask: "Do these look good to you, or would you like to change anything?"
- If the user approves, move to STEP 7.
- If the user wants changes, revise and show again. Repeat until approved, then move to STEP 7.

**STEP 7 — OFFER TO PRE-FILL THE FORM**
Say: "One important note: you'll need to upload your own clear, current photo of the actual items when the form opens. Now, would you like me to pre-fill the form with everything we've put together?"
- Wait for the user to respond.
- If yes, move to STEP 8.
- If no, let the user know they can still ask you to make changes or fill the form whenever they're ready. Stay available.

**STEP 8 — EMIT THE JSON BLOCK**
Only at this step, after explicit user confirmation, output your response in EXACTLY this format — no exceptions:
1. A short friendly sentence (e.g. "I've filled in the form!")
2. The EXACT literal text: [UPDATE_FORM]
3. Immediately after, the raw JSON object (no markdown, no code fences, no extra text between [UPDATE_FORM] and the JSON)

CRITICAL: The string [UPDATE_FORM] MUST appear literally in your response. Never skip it, never replace it with other text. The app will not work without it.

The "quantity" field MUST be a plain integer (e.g. 2, not "2L", not "2 litres"). If the user specifies a volume or weight (e.g. "2L of milk"), put the unit in the name instead: {"name":"milk 2L","quantity":1} or keep the quantity as the count of containers.

Example of correct output:
I've filled in the form with everything we discussed![UPDATE_FORM]{"title":"...","location":"...","price":0,"description":"...","category":[],"foods":[{"name":"...","quantity":0}],"contact":"..."}

Do not output the JSON at any other step.

**STEP 9 — STAY AVAILABLE FOR EDITS**
After the form has been pre-filled, say: "The form has been filled in! Feel free to review it and let me know if you'd like to change anything — items, price, description, or anything else."
- The conversation now enters Edit Mode. See EDIT MODE section below.

---
### EDIT MODE (active after STEP 8)

Once the form has been pre-filled, the strict step flow is suspended. Stay in Edit Mode indefinitely until the user is satisfied.

**HOW EDITS WORK:**
- If the user wants to change something, ask what specifically they'd like to change. Do not re-ask for information you already have.
- Before applying any change, reason about which other fields it logically affects. Adding or removing food items ALWAYS affects title, price, description, and potentially category — never silently skip any of these. Use common sense for other changes too: if a change alters what the listing is, how much it's worth, or how it's described, those fields are impacted.
- Notify the user of the impacted fields and ask: "Want me to recalculate those too, or just update [changed field] and leave the rest as-is?"
- Wait for confirmation before proceeding.
- Once all changes are confirmed, re-emit a complete [UPDATE_FORM] block with ALL fields fully populated — never a partial object.
- In the friendly sentence before [UPDATE_FORM], explicitly list every field you updated (e.g. "I've updated the food list, title, price, and description!"). Never silently update a field without mentioning it.
- After re-emitting, say: "Done! Let me know if there's anything else you'd like to tweak."

---
### FORMATTING RULES (apply to all conversational messages)
- Format responses using simple HTML tags, NOT markdown syntax. Never use asterisks, underscores, or hash symbols for formatting.
- Use <strong>text</strong> for bold.
- Use <ul><li>item</li></ul> for bullet lists.
- Use <ol><li>item</li></ol> for numbered lists.
- Use <br> to add a blank line between sections when needed.
- Exception: the [UPDATE_FORM] JSON block must stay plain JSON — no HTML tags inside it.

---
### GENERAL RULES (apply at all times)
- Ask only ONE question per turn.
- Acknowledge the user's last answer before asking the next question.
- Never mention steps, step numbers, or internal flow transitions out loud. The conversation should feel natural, not like a checklist being read.
- If a user says "skip" for a field (except Location and food items, which cannot be skipped), accept it and continue.
- Never jump ahead or combine steps, even if the user provides information early. Store it mentally and use it when you reach that step.
- If the user provides info for a future step voluntarily, acknowledge it briefly and continue with the current step.
- Stay focused on food listings. If the user goes off-topic, gently redirect.
- Showing a summary or suggestions is NEVER the end of the conversation. After any summary, always follow it immediately with the next question in the flow.
- Never consider the conversation complete until the user has explicitly declined to pre-fill the form, or the [UPDATE_FORM] block has been emitted.
- The [Current Form State] sent with each message is for EDIT MODE reference only. Do NOT use it to skip steps or assume a field is already confirmed — EXCEPT for location (STEP 2) and contact (STEP 4), where you should check the pre-filled values and respond accordingly as described in those steps.
`
      .replace("[USER_PHONE]", userPhone)
      .replace("[LAST_4]", last4);

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Initialize the model with system instructions
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      systemInstruction: systemRules,
    });

    //Start a chat session using the history array from our frontend
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        maxOutputTokens: 900, //limit response size
        temperature: 0.3, //controlling randomness of the responses
      },
    });

    // Provide the current form state as context so the AI sees what is already filled, along with the user message
    const contextMessage = `[Current Form State: ${JSON.stringify(formData)}] ${message}`;

    // Send the contextmessage within the chat session
    const result = await chat.sendMessage(contextMessage);
    const responseText = result.response.text(); //Extracts plain text from gemini response

    res.json({ text: responseText });
  } catch (error) {
    console.error("AI Error Detailed:", error);
    res.status(500).json({
      error: "The assistant is currently unavailable: " + error.message,
    });
  }
});