const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const FormData = require("form-data");
const axios = require("axios");

// Import routes
const authRoutes = require("./routes/auth");
const auth = require("./middleware/auth");

dotenv.config();
const app = express();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload resume for a saved candidate - proxy to FastAPI
app.post("/api/saved-candidates/resume", auth, upload.single("file"), async (req, res) => {
  try {
    const { job_id, candidate_link } = req.body;
    const file = req.file;
    if (!file || !job_id || !candidate_link) {
      return res.status(400).json({ success: false, error: "file, job_id and candidate_link are required" });
    }

    const formData = new FormData();
    formData.append("file", file.buffer, { filename: file.originalname, contentType: file.mimetype });
    formData.append("job_id", job_id);
    formData.append("candidate_link", candidate_link);

    const fastApiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const response = await axios.post(
      `${fastApiUrl}/api/saved-candidates/resume`,
      formData,
      { headers: { ...formData.getHeaders() } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error proxying resume upload:", error?.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to upload resume" });
  }
});

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

// JD Processing route - proxies to FastAPI
app.post("/api/process-jd", auth, upload.single("file"), async (req, res) => {
  try {
    const { jd_text } = req.body;
    const file = req.file;

    // Check if we have text or file
    if (!jd_text && !file) {
      return res.status(400).json({ 
        success: false, 
        error: "Either jd_text or file must be provided." 
      });
    }

    // Create FormData for FastAPI
    const formData = new FormData();
    
    if (file) {
      formData.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    } else if (jd_text) {
      formData.append("jd_text", jd_text);
    }

    // Forward request to FastAPI
    const fastApiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const response = await axios.post(
      `${fastApiUrl}/process-jd`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error processing JD:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to process job description" 
    });
  }
});

// Generate prompts from text - proxy to FastAPI
app.post("/api/generate-prompts", auth, async (req, res) => {
  try {
    const { jd_text } = req.body;

    if (!jd_text) {
      return res.status(400).json({ 
        success: false, 
        error: "jd_text is required." 
      });
    }

    const fastApiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const response = await axios.post(
      `${fastApiUrl}/generate-prompts`,
      { jd_text },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error generating prompts:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate prompts" 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));