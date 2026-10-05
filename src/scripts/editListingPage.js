import {
  displaySimpleWindow,
  closePopupWindow,
  displayWindow,
} from "/src/scripts/popupWindow.js";
import {
  NotifTypes,
  newNotifForConnectedUsers,
} from "/src/scripts/notificationSystem.js";

//GRAB THE ID FROM THE URL
const params = new URLSearchParams(window.location.search);
const listingID = window.location.pathname.split("/").pop();

let data = null;

// =========================================================================================
// This functions fetch a specific listing from the database and converts it to json
// =========================================================================================
async function loadListingData() {
  //fetch foods
  const response = await fetch(`/LoadListing/${listingID}`);
  const listingRecord = await response.json();
  return listingRecord;
}

// =================================================================================================================================
// This function sets default values in the edit listing form pulled from the current information available in the database
// so the users could understand what information needs to be changed.
//==================================================================================================================================
function prefillForm(listingRecord) {
  document.getElementById("editTitle").value = listingRecord.title;
  document.getElementById("editLocation").value = listingRecord.location;
  document.getElementById("editPrice").value = listingRecord.price;
  document.getElementById("editContact").value = listingRecord.contact;
  document.getElementById("editDescription").value = listingRecord.description;
  document.getElementById("editProduce").checked =
    listingRecord.category.includes("Produce") ? true : false;
  document.getElementById("editMeat").checked = listingRecord.category.includes(
    "Meat",
  )
    ? true
    : false;
  document.getElementById("editDairy").checked =
    listingRecord.category.includes("Dairy") ? true : false;
  document.getElementById("editBakedGoods").checked =
    listingRecord.category.includes("Baked Goods") ? true : false;
  document.getElementById("editCookedMeals").checked =
    listingRecord.category.includes("Cooked Meals") ? true : false;
  document.getElementById("listingImg").src =
    listingRecord.image || "images/pantry_share_img_10.jpg";
}

//=============================================================================================
// This function converts a File object to a Base64-encoded data URL for storage and preview
//=============================================================================================
function readImageAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      resolve(e.target.result); // full Base64 string
    };
    reader.onerror = function () {
      reject(new Error("Error reading image"));
    };
    reader.readAsDataURL(file);
  });
}

let currentImg;
// upload image button
const uploadImgBtn = document.getElementById("uploadImgBtn");
uploadImgBtn.addEventListener("click", async () => {
  const listingImg = document.getElementById("listingImageUpload").files[0];
  const encodedImg = await readImageAsBase64(listingImg);
  currentImg = encodedImg;
  document.getElementById("listingImg").src = currentImg;
});

//=======================================================================================
//Preloading food from the existing listing in the database
//=======================================================================================
function loadFoods(listingRecord) {
  const foodArray = listingRecord.foods;

  const foodsList = document.getElementById("foodsList");
  foodsList.innerHTML = "";

  foodArray.forEach((food) => {
    const foodBar = document.createElement("div");
    foodBar.id = "foodBar";
    foodBar.className =
      "flex justify-between rounded-lg text-light-brown border-[#9b9b9b] border-solid border";
    foodBar.innerHTML = `
            <!-- left -->
            <div id="foodBarName" class="py-2 px-4">${food.name}</div>
            <!-- right -->
            <div id="" class="flex">
                <!-- minus -->
                <div id="minusQuant" class="py-2 px-6 border-[#9b9b9b] border-solid border-l">-</div>
                <!-- quant -->
                <div id="itemQuant" class="py-2 min-w-16 text-center border-[#9b9b9b] border-solid border-l">${food.quantity}</div>
                <!-- plus -->
                <div id="plusQuant" class="py-2 px-6 border-[#9b9b9b] border-solid border-l">+</div>
            </div>
        `;
    foodBar.querySelector("#minusQuant").addEventListener("click", () => {
      if (food.quantity > 0) food.quantity -= 1;
      if (food.quantity == 0) {
        const index = foodArray.indexOf(food);
        foodArray.splice(index, 1);
        foodBar.remove();
      }
      loadFoods(listingRecord); //need to reload whenever we want to display updated data
    });

    foodBar.querySelector("#plusQuant").addEventListener("click", () => {
      food.quantity = food.quantity + 1;
      loadFoods(listingRecord); //need to reload whenever we want to display updated data
    });
    foodsList.appendChild(foodBar);
  });
}

//============================================================================================================================================================================
//The addFood function takes the data entered by the user in from the Add Food form and creates a new food bar display with that information. 
//Event listeners are then added to the plus and minus quantity buttons to listen for clicks. It updates and the quantity of food in the foodArray
//If the quantity gets reduced to 0, then food item itself gets removed.
//============================================================================================================================================================================
function addFood(listingRecord) {
  let foodArray = listingRecord.foods;

  const foodForm = document.getElementById("food-form");
  const formData = new FormData(foodForm);

  let isValid = true;

  for (const [key, value] of formData.entries()) {
    if (!value.trim()) isValid = false;
  }

  if (isValid) {
    const foodsList = document.getElementById("foodsList");
    const foodBar = document.createElement("div");

    foodBar.innerHTML += `
    <div id="foodBar" class="flex justify-between rounded-lg text-light-brown border-[#9b9b9b] border-solid border">
        <!-- left -->
        <div id="" class="py-2 px-4">${formData.get("name")}</div>
        <!-- right -->
        <div id="" class="flex">
            <!-- minus -->
            <div id="minusQuant" class="py-2 px-6 border-[#9b9b9b] border-solid border-l">-</div>
            <!-- quant -->
            <div id="itemQuant" class="py-2 min-w-16 text-center border-[#9b9b9b] border-solid border-l">${formData.get("quantity")}</div>
            <!-- plus -->
            <div id="plusQuant" class="py-2 px-6 border-[#9b9b9b] border-solid border-l">+</div>
        </div>
    </div>
    `;

    const itemQuant = foodBar.querySelector("#itemQuant");
    let quantity = parseInt(formData.get("quantity"));

    foodArray.push({ name: formData.get("name"), quantity: quantity });
    let index = foodArray.length - 1;

    foodBar.querySelector("#minusQuant").addEventListener("click", () => {
      if (quantity > 0) {
        quantity -= 1;
        foodArray[index].quantity = quantity;
        loadFoods(listingRecord);
        if (foodArray[index].quantity == 0) {
          foodArray.splice(index, 1);
          foodBar.remove();
        }
      }
    });
    foodBar.querySelector("#plusQuant").addEventListener("click", () => {
      if (quantity > 0) {
        quantity += 1;
        foodArray[index].quantity = quantity;
        loadFoods(listingRecord);
      }
    });
    foodsList.appendChild(foodBar);
    closePopupWindow();
  } else {
    if (foodForm.querySelector(".form-error")) return;

    const error = document.createElement("div");
    error.className = "form-error text-red text-sm";
    error.textContent = "Required fields missing";

    foodForm.appendChild(error);
  }
}

//==============================================================================================
// This function changes the listing status and listing buttons shown on the page
//==============================================================================================
function listingStatus(listingRecord) {
  let statusCircle = document.getElementById("statusCircle");
  let statusLabel = document.getElementById("statusLabel");
  let listingStatusButton = document.getElementById("listingStatusButton");

  if (listingRecord.status == "unlisted") {
    statusCircle.classList.remove("bg-green-500");
    statusCircle.classList.add("bg-red");
    statusLabel.innerText = "Unlisted";
    listingStatusButton.innerText = "Re-list";
  } else if (listingRecord.status == "listed") {
    statusCircle.classList.remove("bg-red");
    statusCircle.classList.add("bg-green-500");
    statusLabel.innerText = "Listed";
    listingStatusButton.innerText = "Unlist";
  }
}

//====================================================================================================================
// This function initialized the page by calling other functions to load listings data, status, and pre-fill the form
//====================================================================================================================
async function initializePage() {
  data = await loadListingData();
  listingStatus(data);
  prefillForm(data);
  loadFoods(data);

  const form = `
    <form id="food-form" class="flex flex-col gap-4 mt-4 text-start">
    <div class="flex flex-col gap-1">
        <label>Name</label>
        <input type="text" name="name" placeholder="Gala apples" />
    </div>
    <div class="flex flex-col gap-1">
        <label>Quantity</label>
        <input type="text" name="quantity" placeholder="2" />
    </div>
    </form>`;

  const deleteConfirmButton = [
  {
    label: "yes, delete",
    color: "box-color-0",
    hover: "hover-outline",
    onClick: async () => {
      const response = await fetch(`/DeleteListing/${listingID}`, {
        method: "PUT",
      }); //soft delete

      if (response.ok) {
        newNotifForConnectedUsers(listingID, NotifTypes.DELETED);
        displaySimpleWindow("Deleted!", [{label: "OK", color: "box-color-0", hover: "hover-outline", onClick: ()=> {window.location.href = "/sell"}}])
      }
      },
  },
  {
    label: "no, cancel",
    color: "box-color-1",
    hover: "hover-outline",
    onClick: () => console.log(""),
  },
];


  const buttons = [
    {
      label: "Add food",
      color: "box-color-0",
      hover: "hover-outline",
      onClick: () => addFood(data), // turn into anonymous function because we need to pass data into addFood, but not call it right away
    },
    {
      label: "cancel",
      color: "box-color-1",
      hover: "hover-outline",
      onClick: closePopupWindow,
    },
  ];

  //add food button - add inside initialize function because we need the data object
  document.getElementById("addFoodButton").addEventListener("click", () => {
    displaySimpleWindow("Add food" + form, buttons, false);
  });

  //delete button
  document.getElementById("deleteButton").addEventListener("click", async () => {
    displaySimpleWindow("Are you sure you want to delete this listing?", deleteConfirmButton);
  });

}

initializePage();



//Unlist or Re-list button
document
  .getElementById("listingStatusButton")
  .addEventListener("click", async () => {
    const listingStatusButton = document.getElementById("listingStatusButton");
    const buttonValue = listingStatusButton.innerText;
    const response = await fetch(`/UpdateListingStatus/${listingID}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buttonValue }),
    });

    if (response.ok) {
      const notifType =
        buttonValue == "Unlist"
          ? NotifTypes.UNLISTED
          : NotifTypes.LISTING_AVAILABLE_AGAIN;
      newNotifForConnectedUsers(listingID, notifType);

      alert("Listing status updated");
      initializePage();
    }
  });

//cancel button
document.getElementById("cancelButton").addEventListener("click", () => {
  window.location.href = "/sell";
});


//save button
document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  
  if (!data) {
    return;
  }

  //get back the updated values
  const updatedTitle = document.getElementById("editTitle").value;
  const updatedLocation = document.getElementById("editLocation").value;
  const updatedPrice = document.getElementById("editPrice").value;
  const updatedContact = document.getElementById("editContact").value;
  const updatedDescription = document.getElementById("editDescription").value;
  const updatedProduce = document.getElementById("editProduce").checked;
  const updatedMeat = document.getElementById("editMeat").checked;
  const updatedDairy = document.getElementById("editDairy").checked;
  const updatedBakedGoods = document.getElementById("editBakedGoods").checked;
  const updatedCookedMeals = document.getElementById("editCookedMeals").checked;
  const updatedImage = currentImg;

  let updatedCategory = [];
  updatedProduce == true ? updatedCategory.push("Produce") : undefined;
  updatedMeat == true ? updatedCategory.push("Meat") : undefined;
  updatedDairy == true ? updatedCategory.push("Dairy") : undefined;
  updatedBakedGoods == true ? updatedCategory.push("Baked Goods") : undefined;
  updatedCookedMeals == true ? updatedCategory.push("Cooked Meals") : undefined;

  const response = await fetch(`/EditListing/${listingID}`, {
    method: "PUT",
    headers: { "content-type": "application/json" }, //metadata about the request
    body: JSON.stringify({
      //wrapping in a single object
      updatedTitle: updatedTitle,
      updatedLocation: updatedLocation,
      updatedPrice: updatedPrice,
      updatedContact: updatedContact,
      updatedDescription: updatedDescription,
      updatedCategory: updatedCategory,
      updatedFoods: data.foods,
      updatedImage: updatedImage,
    }),
  });
  if (response.ok) {
    displaySimpleWindow("Saved!", [{label: "OK", color: "box-color-0", hover: "hover-outline", onClick: ()=> {window.location.href = "/sell"}}])
    initializePage();
  }
});
