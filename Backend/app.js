
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const { createProxyMiddleware } = require("http-proxy-middleware");

// Import routes and middleware
const authRoutes = require("./routes/auth");
const auth = require("./middleware/auth");

dotenv.config();
const app = express();

// --- Core Middlewares ---
// Apply CORS globally
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Error:", err));

// --- API Routes ---

// 1. Authentication routes (handled by this server)
// Apply the express.json() body parser ONLY to these routes.
app.use("/api/auth", express.json(), authRoutes);

// 2. Generic, Authenticated Proxy to FastAPI
// Any request to /api/fastapi/* will be protected by the 'auth' middleware
// and then forwarded to the FastAPI backend. This proxy will handle the body stream itself.
const fastApiProxy = createProxyMiddleware({
  target: process.env.FASTAPI_URL || "http://127.0.0.1:8000",
  changeOrigin: true,
  pathRewrite: {
    '^/api/fastapi': '', // remove /api/fastapi prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    const token = req.header('Authorization');
    if (token) {
      proxyReq.setHeader('Authorization', token);
    }
    console.log(`[PROXY] Forwarding ${req.method} request to FastAPI: ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ success: false, error: 'Proxying request failed.' });
  }
});

// Apply the auth middleware and then the proxy middleware.
// IMPORTANT: Do NOT use express.json() here.
app.use('/api/fastapi', auth, fastApiProxy);


// --- Public & Test Routes ---
app.get("/", (req, res) => res.json({ message: "Backend working fine" }));
app.get("/api/status", (req, res) => res.json({ message: "Frontend and Backend are connected", timestamp: new Date().toISOString(), status: "success" }));
app.get("/api/test", auth, (req, res) => res.json({ message: "This is a protected route", user: req.user, isLoggedIn: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));