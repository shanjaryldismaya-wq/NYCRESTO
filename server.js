
require("dotenv").config();

const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "dbRestaurants";

const client = new MongoClient(MONGODB_URI);

let restaurants;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeAddress(address) {
    if (!address) return "";

    if (typeof address === "string") return address;

    return [
        address.building,
        address.street,
        address.zipcode
    ].filter(Boolean).join(", ");
}

function normalizeGrades(grades) {
    if (!Array.isArray(grades)) return [];

    return grades.map((grade) => {
        if (typeof grade === "number") return grade;

        if (typeof grade === "string") {
            const number = Number(grade);
            return Number.isFinite(number) ? number : null;
        }

        if (grade && grade.score !== undefined) {
            const number = Number(grade.score);
            return Number.isFinite(number) ? number : null;
        }

        return null;
    }).filter((grade) => grade !== null);
}

function formatRestaurant(doc) {
    const grades = normalizeGrades(doc.grades);

    const avgGrade = grades.length
        ? Math.round(
            grades.reduce((sum, grade) => sum + grade, 0) / grades.length
        )
        : 0;

    return {
        id: doc._id.toString(),
        name: doc.name || "",
        borough: doc.borough || "",
        cuisine: doc.cuisine || "",
        address: normalizeAddress(doc.address),
        grades,
        avgGrade
    };
}

function findRestaurantFilter(id) {
    const filters = [];

    if (ObjectId.isValid(id)) {
        filters.push({ _id: new ObjectId(id) });
    }

    filters.push({ restaurant_id: id });
    filters.push({ id: id });

    return { $or: filters };
}

function parseGrades(value) {
    let input;

    if (Array.isArray(value)) {
        input = value;
    } else {
        input = String(value || "").split(",");
    }

    const grades = input
        .map((item) => {
            if (typeof item === "object" && item !== null) {
                return Number(item.score);
            }
            return Number(item);
        })
        .filter((number) =>
            Number.isFinite(number) && number >= 0
        );

    return grades;
}

function validateRestaurant(body) {
    if (
        !String(body.name || "").trim() ||
        !String(body.borough || "").trim() ||
        !String(body.cuisine || "").trim() ||
        !String(body.address || "").trim()
    ) {
        return "Please complete the name, borough, category, and address.";
    }

    const grades = parseGrades(body.grades);

    if (grades.length === 0) {
        return "Please enter at least one valid numeric grade.";
    }

    if (grades.some((grade) => grade > 100)) {
        return "Grades must be between 0 and 100.";
    }

    return null;
}

function makeRestaurantDocument(body) {
    const gradeNumbers = parseGrades(body.grades);

    return {
        name: String(body.name).trim(),
        borough: String(body.borough).trim(),
        cuisine: String(body.cuisine).trim(),
        address: {
            building: "",
            coord: [],
            street: String(body.address).trim(),
            zipcode: ""
        },
        grades: gradeNumbers.map((score) => ({
            date: new Date(),
            grade: score >= 90 ? "A" : score >= 80 ? "B" : "C",
            score
        }))
    };
}

// GET: Retrieve restaurants
app.get("/api/restaurants", async (req, res) => {
    try {
        const docs = await restaurants.find({}).toArray();
        res.json(docs.map(formatRestaurant));
    } catch (error) {
        console.error("Load restaurants error:", error);
        res.status(500).json({
            message: "Failed to load restaurants."
        });
    }
});

// GET: Retrieve one restaurant
app.get("/api/restaurants/:id", async (req, res) => {
    try {
        const doc = await restaurants.findOne(
            findRestaurantFilter(req.params.id)
        );

        if (!doc) {
            return res.status(404).json({
                message: "Restaurant not found."
            });
        }

        res.json(formatRestaurant(doc));
    } catch (error) {
        console.error("Get restaurant error:", error);
        res.status(500).json({
            message: "Failed to retrieve restaurant."
        });
    }
});

// POST: Add restaurant
app.post("/api/restaurants", async (req, res) => {
    try {
        const validationError = validateRestaurant(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const document = makeRestaurantDocument(req.body);
        const result = await restaurants.insertOne(document);

        const saved = await restaurants.findOne({
            _id: result.insertedId
        });

        res.status(201).json(formatRestaurant(saved));
    } catch (error) {
        console.error("Add restaurant error:", error);
        res.status(500).json({
            message: "Failed to add restaurant."
        });
    }
});

// PUT: Update restaurant
app.put("/api/restaurants/:id", async (req, res) => {
    try {
        const validationError = validateRestaurant(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const document = makeRestaurantDocument(req.body);

        const result = await restaurants.updateOne(
            findRestaurantFilter(req.params.id),
            { $set: document }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                message: "Restaurant not found."
            });
        }

        const updated = await restaurants.findOne(
            findRestaurantFilter(req.params.id)
        );

        res.json(formatRestaurant(updated));
    } catch (error) {
        console.error("Update restaurant error:", error);
        res.status(500).json({
            message: "Failed to update restaurant."
        });
    }
});

// DELETE: Delete restaurant
app.delete("/api/restaurants/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const result = await restaurants.deleteOne(
            findRestaurantFilter(id)
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "Restaurant not found or already deleted."
            });
        }

        res.json({
            success: true,
            message: "Restaurant deleted successfully."
        });
    } catch (error) {
        console.error("Delete restaurant error:", error);
        res.status(500).json({
            message: "Failed to delete restaurant."
        });
    }
});

// Start only after MongoDB connects
async function startServer() {
    try {
        await client.connect();

        const db = client.db(DB_NAME);
        restaurants = db.collection("restaurants");

        console.log("MongoDB connected successfully.");
        console.log("Database:", DB_NAME);
        console.log("Collection: restaurants");

        app.listen(PORT, () => {
            console.log(`NYC Resto Finder: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

startServer();
