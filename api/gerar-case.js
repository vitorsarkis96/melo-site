// Gera os textos de um case novo com o Gemini, a partir do contexto que o time escreve no editor.
// Só responde para quem está logado no editor com uma conta do GitHub que pode editar o site.
// Variáveis na Vercel: GEMINI_API_KEY (obrigatória) e GEMINI_MODEL (opcional).
const REPO = "vitorsarkis96/melo-site";
// Se o modelo principal estiver sobrecarregado, tenta os seguintes.
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"].filter((m, i, a) => a.indexOf(m) === i);

const FIELDS = {
  metaTitle: "título para o Google, até 60 caracteres, termina com ' | Melo'",
  metaDescription: "descrição para o Google, 140 a 160 caracteres",
  heroTitleLine2: "nome curto do projeto/entrega, 2 a 6 palavras (ex: Identidade de marca e site)",
  heroAlt: "texto alternativo da foto de capa, descritivo",
  tags: "3 a 5 frentes de trabalho curtas (ex: Identidade visual, Site institucional)",
  challengeHeading: "o desafio de negócio em 1 ou 2 frases fortes, até 200 caracteres",
  challengeDetail: "contexto do desafio em 2 a 4 frases",
  approachHeading: "como a Melo resolveu, 1 ou 2 frases fortes, até 200 caracteres",
  approachDetail: "a solução, as entregas e o resultado em 2 a 4 frases",
  cardTitle: "Cliente: projeto, curto",
  cardDesc: "uma frase para o card do case, até 140 caracteres",
};

const langSchema = {
  type: "OBJECT",
  properties: Object.fromEntries(
    Object.keys(FIELDS).map((k) => [k, k === "tags" ? { type: "ARRAY", items: { type: "STRING" } } : { type: "STRING" }])
  ),
  required: Object.keys(FIELDS),
};

const SYSTEM = `Você é redator sênior da Melo, agência de comunicação corporativa em São Paulo que traduz autoridade técnica em autoridade de marca.
Clientes: empresas B2B e técnicas (saúde, tecnologia, direito, educação, indústria) que entregam bem, mas cuja comunicação não mostra isso.
Escreva o case como a própria Melo contaria: direto, específico, sóbrio, sem exageros nem clichês de agência ("inovador", "disruptivo", "experiência única").
Regras:
- Use só fatos do contexto. Não invente números, prêmios, resultados ou nomes. Se faltar resultado, fale do que foi entregue.
- Nunca use travessão (—) nem meia-risca (–). Use vírgula, dois-pontos ou ponto.
- Português do Brasil em "pt"; inglês natural (não tradução literal) em "en".
- Frases curtas. Títulos sem ponto final.`;

async function canEdit(token) {
  if (!token) return false;
  const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: "token " + token, Accept: "application/vnd.github+json", "User-Agent": "melo-editor" } });
  if (!r.ok) return false;
  const j = await r.json();
  return !!(j.permissions && j.permissions.push);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "A chave do Gemini (GEMINI_API_KEY) ainda não foi configurada na Vercel." });

  const token = (req.headers.authorization || "").replace(/^token\s+|^Bearer\s+/i, "");
  if (!(await canEdit(token))) return res.status(401).json({ error: "Entre no editor com uma conta que pode editar o site." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "JSON inválido." }); } }
  const { name = "", project = "", year = "", context = "", categories = [] } = body || {};
  if (!name.trim() || context.trim().length < 30) return res.status(400).json({ error: "Escreva o nome do cliente e um contexto com pelo menos algumas frases." });
  if (context.length > 12000) return res.status(400).json({ error: "Contexto muito longo. Resuma em até 12 mil caracteres." });

  const prompt = `Cliente: ${name}
Projeto (sugestão do time, pode melhorar): ${project || "(não informado)"}
Ano: ${year || "(não informado)"}
Frentes marcadas: ${(categories || []).join(", ") || "(nenhuma)"}

Contexto do projeto, escrito pelo time:
"""
${context}
"""

Gere os campos do case em "pt" e "en":
${Object.entries(FIELDS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`;

  try {
    const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { pt: langSchema, en: langSchema }, required: ["pt", "en"] },
        },
      });
    let r, j, MODEL; const tries = [];
    for (const m of MODELS) {
      MODEL = m;
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 22000);
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload, signal: ctl.signal,
        });
        j = await r.json().catch(() => ({}));
      } catch (e) {
        r = { ok: false, status: 504 }; j = { error: { message: "high demand (timeout em " + m + ")" } };
      } finally { clearTimeout(timer); }
      const busy = r.status === 504 || r.status === 503 || r.status === 429 || r.status === 404 || /high demand|overloaded|not found/i.test((j.error && j.error.message) || "");
      tries.push(m + ": " + r.status + " " + String((j.error && j.error.message) || "").slice(0, 80));
      if (r.ok || !busy) break;
    }
    if (!r.ok) {
      const msg = (j.error && j.error.message) || r.status;
      return res.status(502).json({ error: /high demand|overloaded/i.test(msg) ? "O Gemini está sobrecarregado agora. Tente de novo em alguns minutos." : "O Gemini recusou o pedido: " + msg, tries });
    }
    const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("") || "";
    let out;
    try { out = JSON.parse(text); } catch (e) { return res.status(502).json({ error: "O Gemini não devolveu um texto válido. Tente de novo." }); }
    const strip = (v) => (Array.isArray(v) ? v.map(strip) : typeof v === "string" ? v.replace(/\s*[—–]\s*/g, ", ").trim() : v);
    for (const l of ["pt", "en"]) for (const k of Object.keys(out[l] || {})) out[l][k] = strip(out[l][k]);
    return res.status(200).json({ model: MODEL, ...out });
  } catch (e) {
    return res.status(500).json({ error: "Falha ao falar com o Gemini: " + e.message });
  }
};
