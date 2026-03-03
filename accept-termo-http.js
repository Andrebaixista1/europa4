const express = require("express");
const { acceptTermoHeadless } = require("./presencaClient");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "accept-termo-http", ts: new Date().toISOString() });
});

app.post("/accept-termo", async (req, res) => {
  const shortUrl = String(req.body?.shortUrl || "").trim();
  const autorizacaoId = String(req.body?.autorizacaoId || "").trim() || null;
  const timeoutSeconds = Number(req.body?.timeoutSeconds || 60);

  if (!shortUrl) {
    return res.status(400).json({ ok: false, error: "shortUrl e obrigatorio" });
  }

  try {
    const startedAt = Date.now();
    const result = await acceptTermoHeadless(shortUrl, autorizacaoId, timeoutSeconds);
    const durationMs = Date.now() - startedAt;
    const ok = Boolean(result?.ok);

    if (!ok) {
      return res.status(502).json({ ok: false, durationMs, details: result || null });
    }

    return res.json({ ok: true, durationMs, details: result || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

const port = Number(process.env.TERMO_HTTP_PORT || process.env.PORT || 3211);
app.listen(port, "0.0.0.0", () => {
  console.log(`[accept-termo-http] listening on :${port}`);
});