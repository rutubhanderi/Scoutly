const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
const app = express();


// Middlewares
app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",  // React Vite frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
 
// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Error:", err));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend working fine" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
