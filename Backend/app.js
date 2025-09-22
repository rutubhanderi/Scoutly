const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Import routes
const authRoutes = require("./routes/auth");
const auth = require("./middleware/auth");

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

// Routes
app.use("/api/auth", authRoutes);

// Test route - unprotected
app.get("/", (req, res) => {
  res.json({ message: "Backend working fine" });
});

// Protected test route
app.get("/api/test", auth, (req, res) => {
  res.json({ 
    message: "This is a protected route", 
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    },
    isLoggedIn: true
  });
});

// Public test route to check connection
app.get("/api/status", (req, res) => {
  res.json({ 
    message: "Frontend and Backend are connected",
    timestamp: new Date().toISOString(),
    status: "success"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));