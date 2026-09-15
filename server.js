const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const FIREBASE_DB =
  process.env.FIREBASE_DB_URL ||
  "https://winzone-sports-default-rtdb.firebaseio.com";

const ALLOWED_METHODS = new Set(["GET", "PUT", "PATCH", "POST", "DELETE"]);

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, PUT, PATCH, POST, DELETE, OPTIONS",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function cleanPath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\.json$/i, "");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve(null);
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

async function proxy(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, { ok: true });

  if (req.url === "/") {
    return send(res, 200, {
      ok: true,
      service: "WinZone Firebase RTDB Proxy",
      endpoint: "/api/rtdb"
    });
  }

  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (u.pathname !== "/api/rtdb") {
    return send(res, 404, { ok: false, error: "Not found" });
  }

  if (!ALLOWED_METHODS.has(req.method)) {
    return send(res, 405, { ok: false, error: "Unsupported method" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return send(res, 401, {
      ok: false,
      error: "Missing Firebase ID token"
    });
  }

  const path = cleanPath(u.searchParams.get("path") || "");
  const firebaseUrl = new URL(
    FIREBASE_DB.replace(/\/+$/, "") +
      (path ? "/" + path : "") +
      ".json"
  );

  const allowedQuery = [
    "orderBy", "equalTo", "startAt", "endAt",
    "limitToFirst", "limitToLast", "shallow", "print"
  ];

  for (const key of allowedQuery) {
    const value = u.searchParams.get(key);
    if (value !== null && value !== "") firebaseUrl.searchParams.set(key, value);
  }

  // Firebase REST accepts the user's Firebase ID token here.
  firebaseUrl.searchParams.set("access_token", token);

  const options = {
    method: req.method,
    headers: { "Content-Type": "application/json" }
  };

  if (req.method !== "GET" && req.method !== "DELETE") {
    options.body = JSON.stringify(await readBody(req));
  }

  try {
    const upstream = await fetch(firebaseUrl, options);
    const text = await upstream.text();

    let data;
    try { data = JSON.parse(text); }
    catch { data = text; }

    if (!upstream.ok) {
      return send(res, upstream.status, {
        ok: false,
        error:
          data && typeof data === "object" && data.error
            ? String(data.error)
            : `Firebase HTTP ${upstream.status}`,
        detail: data
      });
    }

    return send(res, 200, { ok: true, data });
  } catch (err) {
    console.error(err);
    return send(res, 502, {
      ok: false,
      error: "Firebase upstream request failed",
      detail: String(err)
    });
  }
}

const server = http.createServer((req, res) => {
  proxy(req, res).catch(err => {
    console.error(err);
    send(res, 500, {
      ok: false,
      error: "Proxy server error",
      detail: String(err)
    });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WinZone proxy listening on ${PORT}`);
});
