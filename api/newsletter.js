module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = process.env.RD_STATION_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Missing RD_STATION_TOKEN environment variable." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err) {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
  }

  const email = body && body.email;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email is required." });
    return;
  }

  try {
    const rdRes = await fetch(`https://api.rd.services/platform/conversions?api_key=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "CONVERSION",
        event_family: "CDP",
        payload: {
          conversion_identifier: "newsletter-popup",
          email,
        },
      }),
    });

    if (!rdRes.ok) {
      const detail = await rdRes.text();
      res.status(502).json({ error: "RD Station rejected the submission.", detail });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Unexpected error contacting RD Station." });
  }
};
