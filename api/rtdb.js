const FIREBASE_DB =
  process.env.FIREBASE_DB_URL ||
  "https://winzone-sports-default-rtdb.firebaseio.com";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, PUT, PATCH, POST, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing Firebase ID token"
      });
    }

    const path = String(req.query.path || "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.json$/i, "");

    const url = new URL(
      FIREBASE_DB.replace(/\/+$/, "") +
      (path ? "/" + path : "") +
      ".json"
    );

    url.searchParams.set("access_token", token);

    const allowed = [
      "orderBy",
      "equalTo",
      "startAt",
      "endAt",
      "limitToFirst",
      "limitToLast",
      "shallow",
      "print"
    ];

    for (const key of allowed) {
      const value = req.query[key];
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (!["GET", "DELETE"].includes(req.method)) {
      options.body =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? null);
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error:
          data && typeof data === "object" && data.error
            ? String(data.error)
            : `Firebase HTTP ${upstream.status}`,
        detail: data
      });
    }

    return res.status(200).json({
      ok: true,
      data
    });
  } catch (error) {
    console.error("RTDB proxy error:", error);

    return res.status(500).json({
      ok: false,
      error: "Firebase RTDB proxy request failed",
      detail: String(error?.message || error)
    });
  }
};
