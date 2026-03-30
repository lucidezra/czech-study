import express from "express";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "czech-study-dev-secret-change-me";

// ── Database ───────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        correct INT DEFAULT 0,
        wrong INT DEFAULT 0,
        last_seen BIGINT DEFAULT 0,
        UNIQUE(user_id, question)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        score INT NOT NULL,
        total INT NOT NULL,
        passed BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Database tables ready");
  } finally {
    client.release();
  }
}

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ── Auth routes ────────────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name",
      [email.toLowerCase().trim(), hash, displayName || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, display_name FROM users WHERE id = $1", [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Progress routes ────────────────────────────────────────────────────────
app.get("/api/progress", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT question, correct, wrong, last_seen FROM progress WHERE user_id = $1",
      [req.user.id]
    );
    const progress = {};
    result.rows.forEach((r) => {
      progress[r.question] = { correct: r.correct, wrong: r.wrong, lastSeen: Number(r.last_seen) };
    });
    res.json(progress);
  } catch (err) {
    console.error("Progress fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/progress", authMiddleware, async (req, res) => {
  const { question, correct, wrong, lastSeen } = req.body;
  if (!question) return res.status(400).json({ error: "Question required" });
  try {
    await pool.query(
      `INSERT INTO progress (user_id, question, correct, wrong, last_seen)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, question)
       DO UPDATE SET correct = progress.correct + $3, wrong = progress.wrong + $4, last_seen = $5`,
      [req.user.id, question, correct ? 1 : 0, wrong ? 1 : 0, lastSeen || Date.now()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Progress save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Session history routes ─────────────────────────────────────────────────
app.get("/api/sessions", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, mode, score, total, passed, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Sessions fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/sessions", authMiddleware, async (req, res) => {
  const { mode, score, total, passed } = req.body;
  if (!mode || score == null || !total) return res.status(400).json({ error: "Missing fields" });
  try {
    const result = await pool.query(
      "INSERT INTO sessions (user_id, mode, score, total, passed) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, mode, score, total, passed]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Session save error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Serve frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
