import "../components/listingSummaryCard.js";
import { callTutorial } from "./tutorialSystem.js";

let listingHolder = null;
let allListings = [];
const loadLimit = 10;
let loadBatch = 1;
let isLoadingMore = false;
const loadMoreDelay = 800;

document.addEventListener("DOMContentLoaded", async () => {
  const [listingResponse, userResponse] = await Promise.all([
    fetch("/loadListings"),
    fetch("/user"),
  ]);

  const data = await listingResponse.json();
  const currentUser = await userResponse.json();
  const savedItems = currentUser.savedItems || [];

  listingHolder = document.getElementById("listingsHolder");

  let selectedCategories = [];

  const dropdown = document.getElementById("catDropdown");
  const button = document.getElementById("catDropdownButton");
  const selectedText = document.getElementById("catSelectedText");
  const checkboxes = document.querySelectorAll(".catItem");
  const categoriesRoot = document.getElementById("categories");

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  checkboxes.forEach((cb) => {
    cb.addEventListener("change", updateSelection);
  });

  // ===============================================================
  // This function reads the checked category checkboxes, updates the
  // filter label text, and re-renders the listings to match the new
  // selection.
  // ===============================================================
  function updateSelection() {
    selectedCategories = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    selectedText.textContent =
      selectedCategories.length > 0
        ? "Categories: " + selectedCategories.join(", ")
        : "Categories";

    renderListings();
  }

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!categoriesRoot.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  // ===============================================================
  // This function filters the listings by selected categories, then
  // renders the results newest-first and kicks off batch loading
  // via displayBatch().
  // ===============================================================
  function renderListings() {
    listingHolder.innerHTML = "";

    const filtered = data.filter((listing) => {
      if (!listing || listing.status !== "listed") return false;

      const categories = listing.category;

      // normalize categories
      const categoryArray = Array.isArray(categories)
        ? categories
        : [categories];

      // CATEGORY FILTER
      const categoryMatch =
        selectedCategories.length === 0 ||
        selectedCategories.every((selected) =>
          categoryArray.includes(selected),
        );

      return categoryMatch;
    });

    if (filtered.length === 0) {
      listingHolder.innerHTML = `
      <div class="col-span-full text-center text-medium-grey py-10">
        No listings match your filters...
      </div>
    `;
      return;
    }

    allListings = filtered.reverse();
    loadBatch = 1;
    listingHolder.innerHTML = "";
    displayBatch();
  }

  renderListings();

  // ===============================================================
  // This function renders the next page of listings from allListings
  // using loadBatch and loadLimit to slice the correct range, then
  // increments loadBatch so the next call advances the window.
  // Called on initial load and on scroll to implement infinite scroll.
  // ===============================================================
  function displayBatch() {
    const start = (loadBatch - 1) * loadLimit;
    const end = loadBatch * loadLimit;

    if (start >= allListings.length) return;

    let batch = allListings.slice(start, end);

    batch.forEach((newListing) => {
      const newCard = document.createElement("listing-card");

      newCard.setListingInfo(
        newListing._id,
        newListing.title,
        newListing.image,
        newListing.price,
        "default",
        [true, false, false],
        savedItems,
        null,
      );

      listingHolder.appendChild(newCard);
    });

    loadBatch++;
  }

  window.addEventListener("scroll", () => {
    // if loading dont load
    if (isLoadingMore) return;
    const start = (loadBatch - 1) * loadLimit;
    if (start >= allListings.length) return;
    // pos threshold
    const threshold = 300;
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.body.offsetHeight;
    if (scrollPosition >= pageHeight - threshold) {
      isLoadingMore = true;
      setTimeout(() => {
        displayBatch();
        isLoadingMore = false;
      }, loadMoreDelay);
    }
  });
});
