import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(projectRoot, "..");
const appTarget = process.argv[2] || "all";
const apps = {
  student: { root: projectRoot, port: 5174, label: "Student dashboard" },
  login: { root: resolve(projectRoot, "..", "react-login-page"), port: 5173, label: "Login page" },
  admin: { root: resolve(projectRoot, "..", "Admin-Panel"), port: 5175, label: "Admin panel" },
};
const selectedApps = appTarget === "all" ? Object.values(apps) : [apps[appTarget]];
if (selectedApps.includes(undefined)) {
  console.error(`Unknown app target "${appTarget}". Use student, login, admin, or all.`);
  process.exit(1);
}

const pythonPath =
  process.platform === "win32"
    ? join(projectRoot, ".venv", "Scripts", "python.exe")
    : join(projectRoot, ".venv", "bin", "python");

if (!existsSync(pythonPath)) {
  console.error(
    "Python environment not found. Create .venv and install rag-service/requirements.txt first.",
  );
  process.exit(1);
}

async function canUsePort(port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function supportsDocumentIndexingApi() {
  try {
    const response = await fetch("http://127.0.0.1:8000/admin/documents", {
      signal: AbortSignal.timeout(2500),
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

async function findAvailablePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    if (await canUsePort(port, "127.0.0.1")) return port;
  }
  return null;
}

const children = [];
let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

function start(command, args, label, cwd = projectRoot) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(
        `${label} stopped${code === 0 ? "." : ` with exit code ${code ?? "unknown"}.`}`,
      );
      stopAll(code ?? 1);
    }
  });
  return child;
}

let apiPort = 8000;
if (await canUsePort(apiPort, "127.0.0.1")) {
  console.log("Starting the campus RAG API. Press Ctrl+C to stop it.");
  start(
    pythonPath,
    [
      "-m",
      "uvicorn",
      "main:app",
      "--app-dir",
      "rag-service",
      "--host",
      "127.0.0.1",
      "--port",
      String(apiPort),
    ],
    "RAG API",
  );
} else {
  if (await supportsDocumentIndexingApi()) {
    console.log("Port 8000 is already in use. Using the existing helpdesk API.");
  } else {
    const fallbackPort = await findAvailablePort(8001, 8010);
    if (!fallbackPort) {
      console.error(
        "Port 8000 is occupied by an incompatible API, and no fallback API port from 8001 to 8010 is available.",
      );
      process.exit(1);
    }
    apiPort = fallbackPort;
    console.warn(
      `Port 8000 is occupied by an incompatible API. Starting this project's API on port ${apiPort} instead.`,
    );
    start(
      pythonPath,
      [
        "-m",
        "uvicorn",
        "main:app",
        "--app-dir",
        "rag-service",
        "--host",
        "127.0.0.1",
        "--port",
        String(apiPort),
      ],
      "RAG API",
    );
  }
}

process.env.VITE_RAG_API_URL = `http://127.0.0.1:${apiPort}`;

const vitePath = join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(vitePath)) {
  console.error("Shared dependencies are missing. Run npm install from the repository root.");
  stopAll(1);
} else {
  for (const app of selectedApps) {
    if (await canUsePort(app.port, "localhost")) {
      console.log(`Starting ${app.label} at http://localhost:${app.port}.`);
      start(
        process.execPath,
        [vitePath, "dev", "--host", "localhost", "--port", String(app.port), "--strictPort"],
        app.label,
        app.root,
      );
    } else {
      console.log(
        `Port ${app.port} is already in use. Leaving the existing ${app.label.toLowerCase()} running.`,
      );
    }
  }
}

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));
