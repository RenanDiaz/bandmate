require("dotenv").config();
const express = require("express");
const session = require("express-session");

const app = express();
const port = process.env.PORT || 3000;

const connectDB = async () => {
  try {
    // Connect to MongoDB database
    console.log("Connecting to MongoDB...", process.env.MONGODB_URI);
    mongoose
      .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => console.log("Connected to MongoDB"))
      .catch((error) => console.error("Error connecting to MongoDB:", error));
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

// Parse request body as JSON
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "../client/build")));

// Configure express-session
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Mount routes
app.use("/api", publicRoutes);

// Handle all other requests by serving the index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Handle errors
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message });
});

connectDB().then(() => {
  // Start server
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
