
const API_URL = "/api/restaurants";

const restoForm = document.getElementById("restoForm");
const restoId = document.getElementById("restoId");
const nameInput = document.getElementById("name");
const boroughInput = document.getElementById("borough");
const cuisineInput = document.getElementById("cuisine");
const addressInput = document.getElementById("address");
const gradesInput = document.getElementById("grades");

const tableBody = document.getElementById("tableBody");
const formTitle = document.getElementById("formTitle");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("searchBtn");
const bestBtn = document.getElementById("bestBtn");
const resetBtn = document.getElementById("resetBtn");

const boroughButtons = document.getElementById("boroughButtons");
const cuisineButtons = document.getElementById("cuisineButtons");

let allRestaurants = [];
let selectedBorough = "All";
let selectedCuisine = "All";
let bestOnly = false;
let searchText = "";

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "The request failed.");
    }

    return data;
}

function getGrades(restaurant) {
    if (!Array.isArray(restaurant.grades)) return [];

    return restaurant.grades
        .map((grade) => {
            if (typeof grade === "number") return grade;
            if (typeof grade === "string") return Number(grade);

            if (grade && grade.score !== undefined) {
                return Number(grade.score);
            }

            return NaN;
        })
        .filter((grade) => Number.isFinite(grade));
}

function getAverageGrade(restaurant) {
    const grades = getGrades(restaurant);

    if (grades.length === 0) return 0;

    return Math.round(
        grades.reduce((total, grade) => total + grade, 0) /
        grades.length
    );
}

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value === undefined || value === null
        ? ""
        : String(value);

    return cell;
}

function createButton(text, className, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", onClick);

    return button;
}

function showError(message) {
    alert(message);
}

async function loadRestaurants() {
    try {
        allRestaurants = await apiRequest(API_URL);
        renderBoroughButtons();
        renderCuisineButtons();
        renderRestaurants();
    } catch (error) {
        console.error("Load restaurants error:", error);
        tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = error.message;

        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}

function renderBoroughButtons() {
    boroughButtons.replaceChildren();

    const boroughs = [
        "All",
        ...new Set(
            allRestaurants
                .map((restaurant) => restaurant.borough)
                .filter(Boolean)
        )
    ];

    boroughs.forEach((borough) => {
        const label = borough === "All" ? "All Boroughs" : borough;

        const button = createButton(label, "btn", () => {
            selectedBorough = borough;
            renderBoroughButtons();
            renderRestaurants();
        });

        if (selectedBorough === borough) {
            button.classList.add("active");
        }

        boroughButtons.appendChild(button);
    });
}

function renderCuisineButtons() {
    cuisineButtons.replaceChildren();

    const cuisines = [
        "All",
        ...new Set(
            allRestaurants
                .map((restaurant) => restaurant.cuisine)
                .filter(Boolean)
        )
    ];

    cuisines.forEach((cuisine) => {
        const label = cuisine === "All" ? "All Categories" : cuisine;

        const button = createButton(label, "btn", () => {
            selectedCuisine = cuisine;
            renderCuisineButtons();
            renderRestaurants();
        });

        if (selectedCuisine === cuisine) {
            button.classList.add("active");
        }

        cuisineButtons.appendChild(button);
    });
}

function renderRestaurants() {
    tableBody.replaceChildren();

    const filtered = allRestaurants.filter((restaurant) => {
        const matchesSearch =
            !searchText ||
            [
                restaurant.name,
                restaurant.cuisine,
                restaurant.borough,
                restaurant.address
            ].some((value) =>
                String(value || "")
                    .toLowerCase()
                    .includes(searchText)
            );

        const matchesBorough =
            selectedBorough === "All" ||
            restaurant.borough === selectedBorough;

        const matchesCuisine =
            selectedCuisine === "All" ||
            restaurant.cuisine === selectedCuisine;

        const matchesBest =
            !bestOnly || getAverageGrade(restaurant) > 90;

        return (
            matchesSearch &&
            matchesBorough &&
            matchesCuisine &&
            matchesBest
        );
    });

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "No restaurants found.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    filtered.forEach((restaurant) => {
        const row = document.createElement("tr");

        row.appendChild(createCell(restaurant.name));
        row.appendChild(createCell(restaurant.borough));
        row.appendChild(createCell(restaurant.cuisine));
        row.appendChild(createCell(restaurant.address));
        row.appendChild(createCell(getAverageGrade(restaurant)));

        const actionsCell = document.createElement("td");

        const editButton = createButton(
            "Edit",
            "btn",
            () => editRestaurant(restaurant)
        );

        const deleteButton = createButton(
            "Delete",
            "btn delete-btn",
            () => deleteRestaurant(restaurant.id)
        );

        actionsCell.append(editButton, deleteButton);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

// ADD / UPDATE
restoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = restoId.value.trim();

    const restaurant = {
        name: nameInput.value.trim(),
        borough: boroughInput.value,
        cuisine: cuisineInput.value,
        address: addressInput.value.trim(),
        grades: gradesInput.value.trim()
    };

    saveBtn.disabled = true;

    try {
        if (id) {
            await apiRequest(
                `${API_URL}/${encodeURIComponent(id)}`,
                {
                    method: "PUT",
                    body: JSON.stringify(restaurant)
                }
            );

            alert("Restaurant updated successfully!");
        } else {
            await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(restaurant)
            });

            alert("Restaurant added successfully!");
        }

        resetForm();
        await loadRestaurants();
    } catch (error) {
        console.error("Save error:", error);
        showError(error.message);
    } finally {
        saveBtn.disabled = false;
    }
});

// EDIT
function editRestaurant(restaurant) {
    restoId.value = restaurant.id;
    nameInput.value = restaurant.name || "";
    boroughInput.value = restaurant.borough || "";
    cuisineInput.value = restaurant.cuisine || "";
    addressInput.value = restaurant.address || "";
    gradesInput.value = getGrades(restaurant).join(", ");

    formTitle.textContent = "Edit Restaurant";
    saveBtn.textContent = "Save Changes";
    cancelBtn.style.display = "inline-block";

    restoForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// DELETE
async function deleteRestaurant(id) {
    if (!id) {
        showError("Cannot delete this restaurant because its ID is missing.");
        return;
    }

    if (!confirm("Are you sure you want to delete this restaurant?")) {
        return;
    }

    try {
        await apiRequest(
            `${API_URL}/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        // Clear the form if the deleted record was being edited.
        if (restoId.value === id) {
            resetForm();
        }

        alert("Restaurant deleted successfully!");

        // Fetch the latest database records after deletion.
        await loadRestaurants();
    } catch (error) {
        console.error("Delete error:", error);
        showError(error.message);
    }
}

// CANCEL EDIT / RESET FORM
function resetForm() {
    restoForm.reset();
    restoId.value = "";

    formTitle.textContent = "Add a Restaurant";
    saveBtn.textContent = "Add";
    cancelBtn.style.display = "none";
}

cancelBtn.addEventListener("click", resetForm);

// SEARCH
function runSearch() {
    searchText = searchInput.value.trim().toLowerCase();
    renderRestaurants();
}

searchBtn.addEventListener("click", runSearch);

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
    }
});

searchInput.addEventListener("input", runSearch);

// BEST QUALITY: average grade greater than 90
bestBtn.addEventListener("click", () => {
    bestOnly = !bestOnly;

    bestBtn.classList.toggle("active", bestOnly);
    renderRestaurants();
});

// RESET ALL FILTERS
resetBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchText = "";

    selectedBorough = "All";
    selectedCuisine = "All";
    bestOnly = false;

    bestBtn.classList.remove("active");

    resetForm();

    renderBoroughButtons();
    renderCuisineButtons();
    renderRestaurants();
});

// INITIAL LOAD
loadRestaurants();
