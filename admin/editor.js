/* Editor visual do site da Melo.
   Edita os JSONs de conteúdo (src/_data/conteudo/*.json e src/_data/cases/*.json)
   clicando direto na página. Publica com um único commit na main pela API do GitHub;
   a Vercel refaz o site em cerca de 1 minuto. */
(() => {
  const REPO = "vitorsarkis96/melo-site";
  const BRANCH = "main";
  const API = "https://api.github.com";
  const LS_TOKEN = "melo-editor-token";
  const LS_DRAFT = "melo-editor-rascunho";

  const FILES = (key) => {
    if (key === "pt" || key === "en" || key === "geral") return `src/_data/conteudo/${key}.json`;
    if (key.startsWith("case:")) return `src/_data/cases/${key.slice(5)}.json`;
    throw new Error("Arquivo desconhecido: " + key);
  };

  const $ = (s) => document.querySelector(s);
  const state = {
    token: null,
    docs: {},        // key -> { data, sha, original }
    dirty: new Set(),
    uploads: {},     // repoPath -> base64
    previews: {},    // repoPath(public) -> dataURL
    lang: "pt",
    sel: null,       // { kind:'text'|'img', key, item }
    pages: [],
  };

  /* ---------- utilidades ---------- */
  const toast = (msg, ms = 3200) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); };
  const setStatus = (msg, kind = "") => { const s = $("#status"); s.className = "status " + kind; s.innerHTML = msg ? `<span class="dot"></span><span>${msg}</span>` : ""; };
  const confirmBox = (title, text, yes = "Confirmar", input) => new Promise((res) => {
    $("#modalTitle").textContent = title; $("#modalText").textContent = text; $("#modalYes").textContent = yes; $("#modal").hidden = false;
    const inp = $("#modalInput"); inp.hidden = input === undefined; if (input !== undefined) { inp.value = input; inp.placeholder = "https://www.youtube.com/watch?v=..."; setTimeout(() => inp.focus(), 30); }
    const done = (v) => { $("#modal").hidden = true; $("#modalYes").onclick = $("#modalNo").onclick = null; res(v && input !== undefined ? inp.value.trim() : v); };
    $("#modalYes").onclick = () => done(true); $("#modalNo").onclick = () => done(false);
  });
  const b64enc = (str) => btoa(unescape(encodeURIComponent(str)));
  const b64dec = (b64) => decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  const split = (k) => { const i = k.indexOf("|"); return [k.slice(0, i), k.slice(i + 1)]; };
  const getP = (obj, path) => path.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
  const setP = (obj, path, val) => { const ps = path.split("."); const last = ps.pop(); const tgt = ps.reduce((o, p) => o[p], obj); tgt[last] = val; };

  async function gh(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { Authorization: "token " + state.token, Accept: "application/vnd.github+json", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) } });
    if (r.status === 401) { logout(true); throw new Error("Sessão expirada. Entre de novo."); }
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
    return r.status === 204 ? null : r.json();
  }

  /* ---------- login ---------- */
  function savedToken() {
    const t = localStorage.getItem(LS_TOKEN);
    if (t) return t;
    try { const d = JSON.parse(localStorage.getItem("decap-cms-user") || "null"); if (d && d.token) return d.token; } catch (e) {}
    return null;
  }
  function login() {
    const w = 600, h = 700;
    const pop = window.open("/api/auth", "melo-auth", `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
    if (!pop) { showLoginErr("O navegador bloqueou a janela de login. Libere pop-ups para este site."); return; }
    const onMsg = (e) => {
      if (typeof e.data !== "string") return;
      if (e.data === "authorizing:github") { pop.postMessage("authorizing:github", e.origin); return; }
      const m = e.data.match(/^authorization:github:success:(.+)$/);
      if (m) {
        window.removeEventListener("message", onMsg);
        try { const p = JSON.parse(m[1]); localStorage.setItem(LS_TOKEN, p.token); start(p.token); } catch (err) { showLoginErr("Não foi possível concluir o login."); }
      }
      if (/^authorization:github:error/.test(e.data)) showLoginErr("Login recusado pelo GitHub.");
    };
    window.addEventListener("message", onMsg);
  }
  function showLoginErr(m) { const e = $("#loginErr"); e.textContent = m; e.hidden = false; }
  function logout(expired) {
    localStorage.removeItem(LS_TOKEN);
    try { localStorage.removeItem("decap-cms-user"); } catch (e) {}
    state.token = null; $("#app").hidden = true; $("#login").hidden = false;
    if (expired) showLoginErr("Sua sessão expirou. Entre de novo.");
  }

  async function start(token) {
    state.token = token;
    try {
      const repo = await gh(`/repos/${REPO}`);
      if (!repo.permissions || !repo.permissions.push) { logout(); showLoginErr("Esta conta do GitHub não tem permissão para editar o site."); return; }
    } catch (e) { if (state.token) { logout(); showLoginErr(e.message); } return; }
    $("#login").hidden = true; $("#app").hidden = false;
    restoreDraft();
    await loadPages();
    openPage($("#pageSel").value);
  }

  /* ---------- páginas ---------- */
  async function loadPages() {
    const base = [
      { v: "home", pt: "/", en: "/en/", label: "Início" },
      { v: "cases", pt: "/cases", en: "/en/cases", label: "Todos os cases" },
      { v: "contato", pt: "/contato", en: "/en/contact", label: "Contato" },
    ];
    let cases = [];
    try {
      const html = await (await fetch("/cases", { cache: "no-store" })).text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      cases = [...doc.querySelectorAll(".ccard")].map((a) => {
        const slug = a.getAttribute("href").replace(/^\//, "");
        const name = (a.querySelector("h3,.ttl,b,strong") || a).textContent.trim().split("\n")[0].trim();
        return { v: "case:" + slug, pt: "/" + slug, en: "/en/" + slug, label: name || slug };
      });
    } catch (e) {}
    try {
      const dir = await gh(`/repos/${REPO}/contents/src/_data/cases?ref=${BRANCH}`);
      dir.filter((f) => f.name.endsWith(".json")).forEach((f) => {
        const slug = f.name.replace(/\.json$/, "");
        if (!cases.some((c) => c.v === "case:" + slug)) cases.push({ v: "case:" + slug, pt: "/" + slug, en: "/en/" + slug, label: "Rascunho: " + slug, draft: true });
      });
    } catch (e) {}
    state.pages = [...base, ...cases];
    const sel = $("#pageSel");
    sel.innerHTML = `<optgroup label="Páginas">${base.map((p) => `<option value="${p.v}">${p.label}</option>`).join("")}</optgroup>` +
      (cases.length ? `<optgroup label="Cases">${cases.map((p) => `<option value="${p.v}">${p.label}</option>`).join("")}</optgroup>` : "");
    const last = sessionStorage.getItem("melo-editor-page");
    if (last && state.pages.some((p) => p.v === last)) sel.value = last;
  }
  function openPage(v, bust) {
    const p = state.pages.find((x) => x.v === v) || state.pages[0];
    sessionStorage.setItem("melo-editor-page", p.v);
    deselect();
    $("#frameLoading").hidden = false;
    $("#frame").src = p[state.lang] + (bust ? (p[state.lang].includes("?") ? "&" : "?") + "v=" + Date.now() : "");
  }

  /* ---------- documentos ---------- */
  async function loadDoc(key) {
    if (state.docs[key]) return state.docs[key];
    const res = await gh(`/repos/${REPO}/contents/${FILES(key)}?ref=${BRANCH}`);
    const text = b64dec(res.content);
    state.docs[key] = { data: JSON.parse(text), sha: res.sha, original: text };
    return state.docs[key];
  }
  async function loadDocsFor(keys) {
    await Promise.all([...new Set(keys)].map((k) => loadDoc(k).catch((e) => { console.warn(k, e); toast("Não consegui carregar " + k + ": " + e.message, 5000); })));
  }
  function markDirty(key) {
    const d = state.docs[key];
    const now = JSON.stringify(d.data, null, 2) + "\n";
    if (now === d.original) state.dirty.delete(key); else state.dirty.add(key);
    saveDraft(); updateBar();
  }
  function updateBar() {
    const n = state.dirty.size + Object.keys(state.uploads).length;
    $("#count").textContent = n;
    $("#publishBtn").disabled = !n;
    $("#discardBtn").disabled = !n;
    if (n) setStatus(n === 1 ? "1 arquivo com alterações não publicadas" : n + " arquivos com alterações não publicadas", "work");
    else if (!$("#status").classList.contains("ok")) setStatus("");
  }
  function saveDraft() {
    const out = {};
    state.dirty.forEach((k) => (out[k] = { data: state.docs[k].data, sha: state.docs[k].sha, original: state.docs[k].original }));
    try { localStorage.setItem(LS_DRAFT, JSON.stringify({ docs: out, uploads: state.uploads, previews: state.previews })); } catch (e) {}
  }
  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_DRAFT) || "null"); if (!d) return;
      Object.entries(d.docs || {}).forEach(([k, v]) => { state.docs[k] = v; state.dirty.add(k); });
      state.uploads = d.uploads || {}; state.previews = d.previews || {};
      if (state.dirty.size || Object.keys(state.uploads).length) toast("Recuperei as alterações que você não publicou.");
      updateBar();
    } catch (e) {}
  }

  /* ---------- iframe ---------- */
  const frame = () => $("#frame").contentDocument;
  const fwin = () => $("#frame").contentWindow;

  $("#frame").addEventListener("load", async () => {
    const doc = frame(); if (!doc) return;
    // páginas fora do site (ex.: link externo) não são editáveis
    try { doc.location.href; } catch (e) { $("#frameLoading").hidden = true; return; }
    injectFrame(doc);
    const keys = [...doc.querySelectorAll("[data-e],[data-img],[data-item],[data-media],[data-video],[data-gal]")].map((el) => split(el.dataset.e || el.dataset.img || el.dataset.item || el.dataset.media || el.dataset.video || el.dataset.gal)[0]);
    keys.push("geral");
    const cur = state.pages.find((x) => x.v === $("#pageSel").value);
    if (cur && cur.v.startsWith("case:")) keys.push(cur.v);
    await loadDocsFor(keys);
    paintAll();
    $("#frameLoading").hidden = true;
    renderPagePanel();
  });

  function injectFrame(doc) {
    const st = doc.createElement("style");
    st.textContent = `
      .rv,.fade{opacity:1!important;transform:none!important}
      [data-media],[data-video]{cursor:pointer;outline:1px dashed transparent;outline-offset:3px}
      [data-media]:hover,[data-video]:hover{outline-color:#f66324!important}
      [data-media].mel-sel,[data-video].mel-sel{outline:2px solid #f66324!important}
      [data-media] iframe,[data-media] video{pointer-events:none}
      [data-e],[data-img]{cursor:text;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .12s}
      [data-img]{cursor:pointer}
      [data-e]:hover,[data-img]:hover{outline-color:#f66324!important}
      [data-e].mel-sel,[data-img].mel-sel{outline:2px solid #f66324!important;outline-offset:3px}
      [data-e][contenteditable]{cursor:text;caret-color:#f66324}
      [data-e]:empty::before{content:"(vazio)";opacity:.4}
      .mel-item{outline:1px solid rgba(246,99,36,.35);outline-offset:6px}
      .mel-hover{outline:1px dashed rgba(246,99,36,.6)!important;outline-offset:6px}
      #melTb{position:absolute;z-index:2147483000;display:none;align-items:center;gap:2px;background:#0d0d0d;color:#fff;padding:3px;font:500 12px/1 Geist,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25)}
      #melTb .t{padding:0 8px;color:#bbb;white-space:nowrap}
      #melTb button{background:none;border:0;color:#fff;font:inherit;height:26px;padding:0 9px;cursor:pointer}
      #melTb button:hover{background:#f66324}
      #melTb[data-kind=item] [data-a=hide],#melTb[data-kind=sec] [data-a=dup],#melTb[data-kind=sec] [data-a=del]{display:none}
      .mel-changed{box-shadow:inset 0 -2px 0 rgba(246,99,36,.55)}
      a{cursor:default}
    `;
    doc.head.appendChild(st);
    setupToolbar(doc);
    // a imagem de fundo do hero tem conteúdo por cima: seleciona pelo clique no espaço livre
    doc.addEventListener("click", onFrameClick, true);
    doc.addEventListener("input", onFrameInput, true);
    doc.addEventListener("submit", (e) => { e.preventDefault(); toast("O formulário não envia dentro do editor."); }, true);
    doc.addEventListener("keydown", (e) => {
      const el = e.target.closest && e.target.closest("[data-e]");
      if (el && e.key === "Enter" && !isMultiline(el)) { e.preventDefault(); el.blur(); }
      if (e.key === "Escape") deselect();
    }, true);
    doc.addEventListener("paste", (e) => {
      const el = e.target.closest && e.target.closest("[data-e]");
      if (!el) return;
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text/plain");
      doc.execCommand("insertText", false, isMultiline(el) ? txt : txt.replace(/\s*\n\s*/g, " "));
    }, true);
  }
  const isMultiline = (el) => /(\.d|\.a|\.lead|\.text|Detail|\.about|\.body)$/.test(split(el.dataset.e)[1]);

  function onFrameClick(e) {
    const t = e.target;
    const txt = t.closest("[data-e]");
    const media = !txt && t.closest("[data-media]");
    const video = !txt && !media && t.closest("[data-video]");
    if (media || video) { e.preventDefault(); e.stopPropagation(); select({ kind: media ? "media" : "video", el: media || video }); return; }
    const img = !txt && t.closest("[data-img]");
    const link = t.closest("a[href]");
    const hero = !txt && !img && t.closest(".hero");
    if (txt) {
      if (link || t.closest("summary,button")) e.preventDefault();
      if (t.closest("[data-reel]")) e.stopPropagation();
      select({ kind: "text", el: txt });
      return;
    }
    if (img) { e.preventDefault(); e.stopPropagation(); select({ kind: "img", el: img }); return; }
    if (hero && hero.querySelector("[data-img]") && !t.closest("button,a")) {
      const im = hero.querySelector("img.on[data-img]") || hero.querySelector("[data-img]");
      select({ kind: "img", el: im }); return;
    }
    if (link) {
      e.preventDefault();
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#")) { const target = frame().querySelector(href); if (target) target.scrollIntoView({ behavior: "smooth" }); return; }
      const page = state.pages.find((p) => p.pt === href || p.en === href || p.pt === href.replace(/\/$/, ""));
      if (page) { $("#pageSel").value = page.v; openPage(page.v); }
      else toast("Links externos não abrem dentro do editor.");
      return;
    }
    if (!t.closest("button,summary,input,textarea,label")) deselect();
  }

  function onFrameInput(e) {
    const el = e.target.closest && e.target.closest("[data-e]");
    if (!el) return;
    const val = el.innerText.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
    writeValue(el.dataset.e, val, el);
    if (state.sel && state.sel.key === el.dataset.e) { $("#fieldText").value = val; countChars(); }
  }

  function writeValue(key, val, from) {
    const [file, path] = split(key);
    const d = state.docs[file]; if (!d) return;
    setP(d.data, path, val);
    markDirty(file);
    frame().querySelectorAll(`[data-e="${CSS.escape(key)}"]`).forEach((n) => { if (n !== from && n.innerText !== val) n.innerText = val; });
    $("#revertBtn").hidden = !isChanged(key);
  }
  function origValue(key) {
    const [file, path] = split(key); const d = state.docs[file]; if (!d) return undefined;
    try { return getP(JSON.parse(d.original), path); } catch (e) { return undefined; }
  }
  const isChanged = (key) => { const [f, p] = split(key); const d = state.docs[f]; return d && getP(d.data, p) !== origValue(key); };

  // aplica o rascunho na página carregada
  function paintAll() {
    const doc = frame();
    doc.querySelectorAll("[data-e]").forEach((el) => {
      const [f, p] = split(el.dataset.e); const d = state.docs[f]; if (!d) return;
      const v = getP(d.data, p);
      if (typeof v === "string" && el.innerText.trim() !== v) el.innerText = v;
      el.classList.toggle("mel-changed", isChanged(el.dataset.e));
    });
    doc.querySelectorAll("[data-img]").forEach((el) => {
      const [f, p] = split(el.dataset.img); const d = state.docs[f]; if (!d) return;
      const v = getP(d.data, p); if (typeof v !== "string") return;
      const src = state.previews[v] || v;
      if (el.getAttribute("src") !== src) el.setAttribute("src", src);
    });
  }

  /* ---------- seleção e painel ---------- */
  const LABELS = [
    [/rows(Before|After)Approach\.\d+\.title$/, "Case · bloco de texto", "Título"], [/rows(Before|After)Approach\.\d+\.body$/, "Case · bloco de texto", "Texto"],
    [/^hero\.l1$/, "Banner", "Título, linha 1"], [/^hero\.l2$/, "Banner", "Título, linha 2"], [/^hero\.cases$/, "Banner", "Botão de cases"],
    [/^nav\.cta$/, "Geral", "Botão de contato"], [/^meta\.\d+\.label$/, "Banner", "Dado: rótulo"], [/^meta\.\d+\.value$/, "Banner", "Dado: valor"],
    [/^reelSec\.title$/, "Showreel", "Título"], [/^reelSec\.lead$/, "Showreel", "Texto"], [/^reelSec\.cta$/, "Showreel", "Botão"], [/^reelSec\.label$/, "Showreel", "Legenda do vídeo"], [/^reelSec\.watch$/, "Showreel", "Texto 'Assistir'"],
    [/^servicesSec\.title$/, "Serviços", "Título da seção"], [/^servicesSec\.lead$/, "Serviços", "Texto da seção"], [/^servicesSec\.talk$/, "Serviços", "Botão"],
    [/^services\.\d+\.tab$/, "Serviços", "Nome da aba"], [/^services\.\d+\.t$/, "Serviços", "Título do serviço"], [/^services\.\d+\.d$/, "Serviços", "Descrição do serviço"], [/^services\.\d+\.l\.\d+$/, "Serviços", "Entrega"],
    [/^serviceImages\./, "Serviços", "Imagem do serviço"],
    [/^casesSec\.title$/, "Cases", "Título da seção"], [/^casesSec\.all$/, "Cases", "Botão 'todos os cases'"],
    [/^numbersSec\.title$/, "Números", "Título"], [/^numbersSec\.lead$/, "Números", "Texto"],
    [/^reviews\.\d+\.text$/, "Avaliações", "Depoimento"], [/^reviews\.\d+\.name$/, "Avaliações", "Nome"], [/^reviews\.\d+\.company$/, "Avaliações", "Empresa"],
    [/^faqSec\.title$/, "FAQ", "Título"], [/^faqSec\.lead$/, "FAQ", "Texto"], [/^faq\.\d+\.q$/, "FAQ", "Pergunta"], [/^faq\.\d+\.a$/, "FAQ", "Resposta"],
    [/^contactSec\.title$/, "Contato", "Título"], [/^contactSec\.lead$/, "Contato", "Texto"], [/^contactSec\.info\.\d+\.label$/, "Contato", "Informação: rótulo"], [/^contactSec\.info\.\d+\.value$/, "Contato", "Informação: texto"],
    [/^contactSec\.(name|contact|project)$/, "Formulário", "Rótulo do campo"], [/^contactSec\.note$/, "Formulário", "Nota"], [/^contactSec\.send$/, "Formulário", "Botão enviar"],
    [/^contactPage\.title$/, "Página de contato", "Título"], [/^contactPage\.lead$/, "Página de contato", "Texto"],
    [/^casesPage\.title$/, "Página de cases", "Título"], [/^casesPage\.lead$/, "Página de cases", "Texto"],
    [/^casePage\.ctaTitle$/, "Cases", "Título do bloco final"], [/^footer\.about$/, "Rodapé", "Texto sobre a Melo"],
    [/heroTitleLine1$/, "Case", "Nome do cliente"], [/heroTitleLine2$/, "Case", "Projeto"], [/challengeHeading$/, "Case", "Desafio: título"], [/challengeDetail$/, "Case", "Desafio: texto"],
    [/cardDesc$/, "Case", "Descrição no card"], [/^cardImage$/, "Case", "Imagem do card"], [/approachHeading$/, "Case", "Abordagem: título"], [/approachDetail$/, "Case", "Abordagem: texto"], [/^heroMedia\.src$/, "Case", "Imagem principal"],
  ];
  const ITEM_NAMES = { rowsBeforeApproach: "Bloco da galeria", rowsAfterApproach: "Bloco da galeria", faq: "Pergunta do FAQ", reviews: "Avaliação", meta: "Dado do banner", "contactSec.info": "Informação de contato", services: "Serviço", l: "Entrega" };
  function labelFor(key) {
    const [file, path] = split(key);
    const p = file.startsWith("case:") ? path.replace(/^(pt|en)\./, "") : path;
    const hit = LABELS.find(([re]) => re.test(p) || re.test(path));
    const where = file === "en" || /^en\./.test(path) ? " · inglês" : file === "geral" ? " · todas as línguas" : file === "pt" && /^reviews/.test(path) && state.lang === "en" ? " · vale para PT e EN" : "";
    return hit ? [hit[1] + where, hit[2]] : ["Conteúdo" + where, path];
  }

  function select({ kind, el }) {
    const doc = frame();
    doc.querySelectorAll(".mel-sel").forEach((n) => { n.classList.remove("mel-sel"); if (n !== el) n.removeAttribute("contenteditable"); });
    doc.querySelectorAll(".mel-item").forEach((n) => n.classList.remove("mel-item"));
    el.classList.add("mel-sel");
    const key = kind === "text" ? el.dataset.e : kind === "media" ? el.dataset.media : kind === "video" ? el.dataset.video : el.dataset.img;
    const item = el.closest("[data-item]");
    state.sel = { kind, key, el, item: item ? item.dataset.item : null };
    if (item) item.classList.add("mel-item");
    let [crumb, name] = labelFor(key);
    if (kind === "media") { crumb = "Case · galeria"; name = "Foto ou vídeo"; }
    if (kind === "video") { crumb = "Showreel"; name = "Vídeo do showreel"; }
    if (kind === "img" && el.dataset.caseName && $("#pageSel").value === "home") { crumb = "Banner"; name = "Foto do banner"; }
    $("#crumbs").textContent = crumb; $("#fieldName").textContent = name;
    $("#sideEmpty").hidden = true; $("#sideEdit").hidden = false;
    $("#textBox").hidden = kind !== "text"; $("#imgBox").hidden = kind !== "img"; $("#mediaBox").hidden = kind !== "media" && kind !== "video";
    if (kind === "media" || kind === "video") fillMedia();
    if (kind === "text") {
      if (!el.isContentEditable) { el.setAttribute("contenteditable", "plaintext-only"); if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true"); }
      el.focus();
      const [f, p] = split(key); const v = getP((state.docs[f] || {}).data || {}, p);
      $("#fieldText").value = typeof v === "string" ? v : el.innerText;
      $("#fieldText").rows = isMultiline(el) ? 7 : 2;
      countChars();
      $("#revertBtn").hidden = !isChanged(key);
    } else if (kind === "img") {
      const [f, p] = split(key); const v = getP((state.docs[f] || {}).data || {}, p) || el.getAttribute("src");
      $("#imgPath").value = v; $("#imgPrev").src = state.previews[v] || v;
      if (el.dataset.caseName && $("#pageSel").value === "home") toast("Esta foto também é a capa do case " + el.dataset.caseName + ".", 4000);
    }
    if (item) {
      const [, ip] = split(item.dataset.item);
      const arr = ip.replace(/\.\d+$/, "");
      const nm = ITEM_NAMES[arr] || ITEM_NAMES[arr.split(".").pop()] || "Item da lista";
      $("#itemLabel").textContent = nm + " · " + (+ip.split(".").pop() + 1) + "º";
      $("#itemBox").hidden = false;
    } else $("#itemBox").hidden = true;
  }
  function deselect() {
    const doc = frame();
    if (doc) { doc.querySelectorAll(".mel-sel").forEach((n) => { n.classList.remove("mel-sel"); n.removeAttribute("contenteditable"); }); doc.querySelectorAll(".mel-item").forEach((n) => n.classList.remove("mel-item")); }
    state.sel = null; $("#sideEmpty").hidden = false; $("#sideEdit").hidden = true;
    if (frame()) renderPagePanel();
  }
  const countChars = () => { const n = $("#fieldText").value.length; $("#charCount").textContent = n + (n === 1 ? " caractere" : " caracteres"); };

  $("#fieldText").addEventListener("input", () => {
    if (!state.sel || state.sel.kind !== "text") return;
    const v = $("#fieldText").value;
    countChars();
    state.sel.el.innerText = v;
    writeValue(state.sel.key, v.trim(), state.sel.el);
    state.sel.el.classList.toggle("mel-changed", isChanged(state.sel.key));
  });
  $("#revertBtn").onclick = () => {
    if (!state.sel) return; const o = origValue(state.sel.key); if (typeof o !== "string") return;
    $("#fieldText").value = o; state.sel.el.innerText = o; writeValue(state.sel.key, o, state.sel.el); state.sel.el.classList.remove("mel-changed"); countChars();
  };
  $("#deselect").onclick = deselect;

  /* ---------- imagens ---------- */
  $("#imgPath").addEventListener("change", () => {
    if (!state.sel || state.sel.kind !== "img") return;
    const v = $("#imgPath").value.trim(); if (!v) return;
    const [f, p] = split(state.sel.key); setP(state.docs[f].data, p, v); markDirty(f);
    $("#imgPrev").src = state.previews[v] || v; paintAll();
  });
  $("#imgFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file || !state.sel || state.sel.kind !== "img") return;
    const publicPath = await stageUpload(file); if (!publicPath) return;
    const dataURL = state.previews[publicPath];
    const [f, p] = split(state.sel.key); setP(state.docs[f].data, p, publicPath); markDirty(f);
    $("#imgPath").value = publicPath; $("#imgPrev").src = dataURL; paintAll();
    toast("Imagem trocada. Ela vai para o site quando você publicar.");
  });

  /* ---------- itens de lista ---------- */
  document.querySelectorAll("#itemBox [data-op]").forEach((b) => b.addEventListener("click", () => { if (state.sel && state.sel.item) itemOp(b.dataset.op, state.sel.item); }));
  // troca o prefixo de um nó (e dos filhos) na prévia
  function rekey(n, from, to) {
    [n, ...n.querySelectorAll("[data-item],[data-e],[data-img],[data-media]")].forEach((x) => {
      ["item", "e", "img", "media"].forEach((a) => { const v = x.dataset[a]; if (v && (v === from || v.startsWith(from + "."))) x.dataset[a] = to + v.slice(from.length); });
    });
  }
  function renumber(prefix) {
    const doc = frame();
    const nodes = [...doc.querySelectorAll("[data-item]")].filter((n) => n.dataset.item.startsWith(prefix) && /^\d+$/.test(n.dataset.item.slice(prefix.length)));
    nodes.forEach((n, i) => rekey(n, n.dataset.item, prefix + "tmp" + i));
    nodes.forEach((n, i) => rekey(n, n.dataset.item, prefix + i));
  }
  async function itemOp(op, itemKey) {
    const [file, ipath] = split(itemKey);
    const idx = +ipath.split(".").pop();
    const arrPath = ipath.replace(/\.\d+$/, "");
    const d = state.docs[file]; const arr = getP(d.data, arrPath);
    if (!Array.isArray(arr)) return;
    const doc = frame();
    const prefix = `${file}|${arrPath}.`;
    const node = doc.querySelector(`[data-item="${CSS.escape(itemKey)}"]`);
    const isGal = /rows(Before|After)Approach$/.test(arrPath);
    if (op === "del") {
      if (arr.length <= 1 && !isGal) { toast("A lista precisa ter pelo menos um item."); return; }
      if (!(await confirmBox("Remover item?", "O item sai da página quando você publicar. Dá para desfazer com 'Descartar' antes de publicar.", "Remover"))) return;
    }
    let newKey = itemKey;
    // nos cases, o bloco passa de um lado para o outro do texto "A abordagem"
    const cross = isGal && ((op === "up" && idx === 0 && arrPath === "rowsAfterApproach") || (op === "down" && idx === arr.length - 1 && arrPath === "rowsBeforeApproach"));
    if (cross) {
      const toPath = arrPath === "rowsAfterApproach" ? "rowsBeforeApproach" : "rowsAfterApproach";
      d.data[toPath] = d.data[toPath] || [];
      const [x] = arr.splice(idx, 1);
      const toPrefix = `${file}|${toPath}.`;
      const gal = doc.querySelector(`[data-gal="${CSS.escape(file + "|" + toPath)}"]`);
      if (toPath === "rowsBeforeApproach") { d.data[toPath].push(x); newKey = toPrefix + (d.data[toPath].length - 1); if (node && gal) gal.appendChild(node); }
      else { d.data[toPath].unshift(x); newKey = toPrefix + "0"; if (node && gal) gal.prepend(node); }
      if (node) rekey(node, itemKey, toPrefix + "moving");
      renumber(prefix); renumber(toPrefix);
      toast(toPath === "rowsBeforeApproach" ? "Bloco movido para antes de 'A abordagem'." : "Bloco movido para depois de 'A abordagem'.");
    } else {
      if (op === "up") { if (idx === 0) { toast("Este já é o primeiro."); return; } [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; newKey = prefix + (idx - 1); if (node && node.previousElementSibling) node.parentNode.insertBefore(node, node.previousElementSibling); }
      if (op === "down") { if (idx >= arr.length - 1) { toast("Este já é o último."); return; } [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; newKey = prefix + (idx + 1); if (node && node.nextElementSibling) node.parentNode.insertBefore(node.nextElementSibling, node); }
      if (op === "dup") { arr.splice(idx + 1, 0, JSON.parse(JSON.stringify(arr[idx]))); newKey = prefix + (idx + 1); if (node) node.after(node.cloneNode(true)); }
      if (op === "del") { arr.splice(idx, 1); newKey = null; if (node) node.remove(); }
      renumber(prefix);
      toast(op === "del" ? "Item removido." : op === "dup" ? "Item adicionado abaixo. Edite o conteúdo da cópia." : "Ordem alterada.");
    }
    markDirty(file);
    deselect();
    if (newKey) {
      const n = doc.querySelector(`[data-item="${CSS.escape(newKey)}"]`);
      const first = n && (n.querySelector("[data-e]") || n.querySelector("[data-media]"));
      if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); select({ kind: first.dataset.e ? "text" : "media", el: first }); }
    }
  }


  /* ---------- publicar ---------- */
  async function publish() {
    const files = [...state.dirty];
    const ups = Object.entries(state.uploads);
    if (!files.length && !ups.length) return;
    $("#publishBtn").disabled = true; setStatus("Publicando…", "work");
    try {
      // confere se ninguém mudou os arquivos no meio do caminho
      for (const k of files) {
        if (!state.docs[k].sha) continue;
        const cur = await gh(`/repos/${REPO}/contents/${FILES(k)}?ref=${BRANCH}`);
        if (cur.sha !== state.docs[k].sha) {
          const ok = await confirmBox("Arquivo alterado por outra pessoa", `${FILES(k)} mudou desde que você abriu o editor (talvez pelo modo avançado). Publicar mesmo assim substitui essa versão.`, "Publicar mesmo assim");
          if (!ok) throw new Error("Publicação cancelada.");
        }
      }
      const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
      const head = await gh(`/repos/${REPO}/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const [path, b64] of ups) {
        const blob = await gh(`/repos/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: b64, encoding: "base64" }) });
        tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      }
      for (const k of files) tree.push({ path: FILES(k), mode: "100644", type: "blob", content: JSON.stringify(state.docs[k].data, null, 2) + "\n" });
      const newTree = await gh(`/repos/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const what = files.map((k) => (k.startsWith("case:") ? "case " + k.slice(5) : k === "geral" ? "geral" : "textos " + k.toUpperCase())).join(", ");
      const commit = await gh(`/repos/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message: `Editor visual: ${what}${ups.length ? ` + ${ups.length} imagem(ns)` : ""}`, tree: newTree.sha, parents: [head.sha] }) });
      await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      // atualiza a base local
      for (const k of files) {
        const fresh = await gh(`/repos/${REPO}/contents/${FILES(k)}?ref=${commit.sha}`);
        state.docs[k] = { data: state.docs[k].data, sha: fresh.sha, original: JSON.stringify(state.docs[k].data, null, 2) + "\n" };
      }
      state.dirty.clear(); state.uploads = {}; saveDraft(); updateBar();
      frame() && frame().querySelectorAll(".mel-changed").forEach((n) => n.classList.remove("mel-changed"));
      setStatus("Enviado. Atualizando o site…", "work");
      watchDeploy(commit.sha);
    } catch (e) {
      setStatus(e.message, "err"); toast(e.message, 6000); updateBar();
    }
  }
  async function watchDeploy(sha) {
    const t0 = Date.now();
    const tick = async () => {
      try {
        const st = await gh(`/repos/${REPO}/commits/${sha}/status`);
        if (st.state === "success") {
          setStatus("No ar. Site atualizado.", "ok"); toast("Publicado! O site já está atualizado."); state.previews = {}; saveDraft();
          if (state.openAfter) { await loadPages(); $("#pageSel").value = state.openAfter; state.openAfter = null; }
          openPage($("#pageSel").value, true); return;
        }
        if (st.state === "failure" || st.state === "error") { setStatus("A atualização do site falhou. Veja no modo avançado ou peça ajuda.", "err"); return; }
      } catch (e) {}
      if (Date.now() - t0 > 6 * 60 * 1000) { setStatus("Enviado. O site deve atualizar em instantes.", "ok"); return; }
      setTimeout(tick, 5000);
    };
    setTimeout(tick, 8000);
  }

  async function discard() {
    if (!(await confirmBox("Descartar alterações?", "Tudo o que você mudou e ainda não publicou será perdido.", "Descartar"))) return;
    state.dirty.forEach((k) => delete state.docs[k]);
    state.dirty.clear(); state.uploads = {}; state.previews = {};
    localStorage.removeItem(LS_DRAFT); updateBar(); setStatus("");
    openPage($("#pageSel").value, true);
  }

  /* ---------- eventos da barra ---------- */
  $("#loginBtn").onclick = login;
  $("#logoutBtn").onclick = async () => {
    if (state.dirty.size && !(await confirmBox("Sair do editor?", "Suas alterações não publicadas ficam salvas neste navegador.", "Sair"))) return;
    logout();
  };
  $("#publishBtn").onclick = publish;
  $("#discardBtn").onclick = discard;
  $("#pageSel").onchange = (e) => openPage(e.target.value);
  $("#moreBtn").onclick = (e) => { e.stopPropagation(); $("#moreMenu").hidden = !$("#moreMenu").hidden; };
  document.addEventListener("click", () => ($("#moreMenu").hidden = true));
  document.querySelectorAll("#langSeg button").forEach((b) => (b.onclick = () => {
    document.querySelectorAll("#langSeg button").forEach((x) => x.classList.toggle("on", x === b));
    state.lang = b.dataset.lang; openPage($("#pageSel").value);
  }));
  document.querySelectorAll("#devSeg button").forEach((b) => (b.onclick = () => {
    document.querySelectorAll("#devSeg button").forEach((x) => x.classList.toggle("on", x === b));
    $("#frameWrap").classList.toggle("mob", b.dataset.dev === "mob");
  }));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!$("#publishBtn").disabled) publish(); }
  });
  window.addEventListener("beforeunload", (e) => { if (state.dirty.size) { e.preventDefault(); e.returnValue = ""; } });


  /* ---------- vídeo e mídia da galeria ---------- */
  const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(u || "") ? u : null; };
  const ytEmbed = (id) => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1" title="Vídeo" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen style="pointer-events:none"></iframe>`;
  const pickFile = () => new Promise((res) => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/png,image/jpeg,image/webp,image/gif"; i.onchange = () => res(i.files[0] || null); i.click(); });
  // Reduz fotos grandes no navegador (máx. 2400 px, JPEG) para o upload ficar leve.
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return null;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const max = 2400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      if (k === 1 && file.size < 1.5 * 1024 * 1024) return null;
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d");
      const keepPng = file.type === "image/png" && file.size < 3 * 1024 * 1024;
      if (!keepPng) { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      return { dataURL: c.toDataURL(keepPng ? "image/png" : "image/jpeg", 0.85), ext: keepPng ? "png" : "jpg" };
    } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
  }
  async function stageUpload(file) {
    if (!file) return null;
    if (file.size > 40 * 1024 * 1024) { toast("Arquivo acima de 40 MB. Use uma imagem menor."); return null; }
    const small = await shrink(file);
    const dataURL = small ? small.dataURL : await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    if (dataURL.length > 14 * 1024 * 1024) { toast("Imagem muito pesada mesmo depois de reduzida. Use uma versão menor."); return null; }
    const base = file.name.replace(/\.[^.]+$/, "");
    const clean = (small ? base + "." + small.ext : file.name).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
    const publicPath = `/assets/img/uploads/${Date.now()}-${clean}`;
    state.uploads[publicPath.slice(1)] = dataURL.split(",")[1];
    state.previews[publicPath] = dataURL;
    return publicPath;
  }
  const curVal = (key) => { const [f, p] = split(key); return getP((state.docs[f] || {}).data || {}, p); };
  const setVal = (key, v) => { const [f, p] = split(key); setP(state.docs[f].data, p, v); markDirty(f); };

  function setMediaTab(t) {
    document.querySelectorAll("#mediaType button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    $("#mediaImg").hidden = t !== "image"; $("#mediaVid").hidden = t !== "video";
  }
  function fillMedia() {
    const sel = state.sel;
    if (sel.kind === "video") {
      $("#mediaType").hidden = true; setMediaTab("video");
      const id = curVal(sel.key); $("#mediaUrl").value = id ? "https://www.youtube.com/watch?v=" + id : "";
      return;
    }
    $("#mediaType").hidden = false;
    const it = curVal(sel.key) || {};
    const isVid = it.type === "video";
    setMediaTab(isVid ? "video" : "image");
    $("#mediaUrl").value = isVid ? it.src : "";
    $("#mediaPrev").src = !isVid ? state.previews[it.src] || it.src || "" : "";
  }
  document.querySelectorAll("#mediaType button").forEach((b) => (b.onclick = () => setMediaTab(b.dataset.t)));
  function paintMedia(el, it) {
    if (it.type === "video") {
      const id = ytId(it.src);
      const box = el.ownerDocument.createElement("div"); box.className = "vid"; box.dataset.media = el.dataset.media;
      box.innerHTML = id ? ytEmbed(id) : `<video src="${it.src}" controls></video>`;
      el.replaceWith(box); return box;
    }
    let fig = el;
    if (el.tagName !== "FIGURE") { fig = el.ownerDocument.createElement("figure"); fig.dataset.media = el.dataset.media; el.replaceWith(fig); }
    let im = fig.querySelector("img"); if (!im) { im = el.ownerDocument.createElement("img"); fig.innerHTML = ""; fig.appendChild(im); }
    im.src = state.previews[it.src] || it.src; return fig;
  }
  $("#mediaFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!state.sel || state.sel.kind !== "media") return;
    const path = await stageUpload(f); if (!path) return;
    const it = { ...(curVal(state.sel.key) || {}), type: "image", src: path }; delete it.loop; delete it.poster;
    setVal(state.sel.key, it);
    const el = paintMedia(state.sel.el, it); state.sel.el = el; el.classList.add("mel-sel");
    $("#mediaPrev").src = state.previews[path];
    toast("Foto trocada. Ela vai para o site quando você publicar.");
  });
  $("#mediaUrlApply").onclick = () => {
    if (!state.sel) return;
    const id = ytId($("#mediaUrl").value.trim());
    if (!id) { toast("Não reconheci esse link do YouTube."); return; }
    if (state.sel.kind === "video") {
      setVal(state.sel.key, id);
      const im = state.sel.el.querySelector("img"); if (im) im.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      toast("Showreel trocado."); return;
    }
    const it = { type: "video", src: "https://youtu.be/" + id };
    setVal(state.sel.key, it);
    const el = paintMedia(state.sel.el, it); state.sel.el = el; el.classList.add("mel-sel");
    toast("Vídeo colocado.");
  };

  /* ---------- barra flutuante (ordem, adicionar, remover) ---------- */
  const SEC_NAMES = { reel: "Showreel", servicos: "Serviços", cases: "Cases", numeros: "Números e avaliações", contato: "Contato", faq: "FAQ" };
  function itemName(itemKey) {
    const [, ip] = split(itemKey); const arr = ip.replace(/\.\d+$/, "");
    return ITEM_NAMES[arr] || ITEM_NAMES[arr.split(".").pop()] || "Item";
  }
  function setupToolbar(doc) {
    const tb = doc.createElement("div"); tb.id = "melTb";
    tb.innerHTML = `<span class="t"></span><button data-a="up" title="Subir">↑</button><button data-a="down" title="Descer">↓</button><button data-a="dup" title="Adicionar uma cópia logo abaixo">+ Adicionar</button><button data-a="del" title="Remover">Remover</button><button data-a="hide" title="Ocultar seção">Ocultar</button>`;
    doc.body.appendChild(tb);
    let target = null, kind = null, hideT;
    const place = () => {
      if (!target || !target.isConnected) { tb.style.display = "none"; return; }
      const r = target.getBoundingClientRect(), w = doc.defaultView;
      tb.style.display = "flex";
      tb.style.top = Math.max(w.scrollY + 64, r.top + w.scrollY - 34) + "px";
      tb.style.left = Math.max(8, Math.min(w.innerWidth - tb.offsetWidth - 8, r.right + w.scrollX - tb.offsetWidth)) + "px";
    };
    const show = (el, k) => {
      clearTimeout(hideT);
      if (target === el) return place();
      if (target) target.classList.remove("mel-hover");
      target = el; kind = k; el.classList.add("mel-hover");
      tb.dataset.kind = k;
      tb.querySelector(".t").textContent = k === "sec" ? "Seção: " + (SEC_NAMES[el.dataset.section] || el.dataset.section) : itemName(el.dataset.item);
      place();
    };
    doc.addEventListener("mouseover", (e) => {
      if (tb.contains(e.target)) { clearTimeout(hideT); return; }
      const it = e.target.closest("[data-item]");
      if (it) return show(it, "item");
      const sec = e.target.closest("[data-section]");
      if (sec) return show(sec, "sec");
      hideT = setTimeout(() => { if (target) target.classList.remove("mel-hover"); target = null; place(); }, 250);
    });
    doc.defaultView.addEventListener("scroll", place, { passive: true });
    tb.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const a = e.target.closest("button"); if (!a || !target) return;
      const op = a.dataset.a;
      if (kind === "item") itemOp(op === "dup" ? "dup" : op, target.dataset.item);
      else secOp(op, target.dataset.section);
      setTimeout(place, 50);
    }, true);
  }

  function secOp(op, key) {
    const arr = curVal("geral|homeSections"); if (!Array.isArray(arr)) return;
    const i = arr.findIndex((s) => s.key === key); if (i < 0) return;
    const doc = frame(); const node = doc.querySelector(`[data-section="${key}"]`);
    const vis = (j) => arr[j] && arr[j].show !== false;
    if (op === "up") { let j = i - 1; while (j >= 0 && !vis(j)) j--; if (j < 0) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); const prev = doc.querySelector(`[data-section="${arr[j + 1].key}"]`); if (node && prev) prev.before(node); }
    if (op === "down") { let j = i + 1; while (j < arr.length && !vis(j)) j++; if (j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); const next = doc.querySelector(`[data-section="${arr[j - 1].key}"]`); if (node && next) next.after(node); }
    if (op === "hide" || op === "del") { arr[i].show = false; if (node) node.style.display = "none"; toast("Seção oculta. Para mostrar de novo, use 'Seções da home' no painel."); }
    setVal("geral|homeSections", arr);
    if (node && node.style.display !== "none") node.scrollIntoView({ behavior: "smooth", block: "start" });
    renderPagePanel();
  }
  function sectionsManager() {
    const wrap = document.createElement("div"); wrap.className = "pp-sec";
    wrap.innerHTML = `<b>Seções da home</b><span class="small">Mude a ordem, mostre ou oculte. Também dá para fazer pela barra que aparece ao passar o mouse na página.</span><div class="lm"></div>`;
    const lm = wrap.querySelector(".lm");
    const draw = () => {
      const a = curVal("geral|homeSections") || [];
      lm.innerHTML = a.map((s, i) => `<div class="lm-row sec-row"><label class="chk"><input type="checkbox" data-show="${i}"${s.show !== false ? " checked" : ""}> ${SEC_NAMES[s.key] || s.key}</label><button data-up="${i}" title="Subir">↑</button><button data-down="${i}" title="Descer">↓</button><span></span></div>`).join("");
    };
    wrap.addEventListener("change", (e) => {
      const i = e.target.dataset.show; if (i === undefined) return;
      const a = curVal("geral|homeSections"); a[+i].show = e.target.checked; setVal("geral|homeSections", a);
      const node = frame().querySelector(`[data-section="${a[+i].key}"]`);
      if (node) node.style.display = e.target.checked ? "" : "none";
      else if (e.target.checked) toast("A seção volta a aparecer depois de publicar.");
    });
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const a = curVal("geral|homeSections"); const i = +(b.dataset.up || b.dataset.down);
      const j = b.dataset.up !== undefined ? i - 1 : i + 1; if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]]; setVal("geral|homeSections", a);
      const doc = frame(); const ni = doc.querySelector(`[data-section="${a[j].key}"]`), nj = doc.querySelector(`[data-section="${a[i].key}"]`);
      if (ni && nj) { if (j < i) nj.before(ni); else nj.after(ni); }
      draw();
    });
    draw(); return wrap;
  }

  /* ---------- painel da página (nada selecionado) ---------- */
  const caseList = () => state.pages.filter((p) => p.v.startsWith("case:")).map((p) => ({ slug: p.v.slice(5), name: p.label }));
  function listManager(title, key, hint) {
    const arr = curVal(key) || [];
    const opts = caseList();
    const wrap = document.createElement("div"); wrap.className = "pp-sec";
    wrap.innerHTML = `<b>${title}</b>${hint ? `<span class="small">${hint}</span>` : ""}<div class="lm"></div><button class="b b-ghost b-block" data-add>+ Adicionar case</button>`;
    const lm = wrap.querySelector(".lm");
    const draw = () => {
      const a = curVal(key) || [];
      lm.innerHTML = a.map((slug, i) => `<div class="lm-row"><select data-i="${i}">${opts.map((o) => `<option value="${o.slug}"${o.slug === slug ? " selected" : ""}>${o.name}</option>`).join("")}</select><button data-up="${i}" title="Subir">↑</button><button data-down="${i}" title="Descer">↓</button><button data-del="${i}" title="Remover">×</button></div>`).join("");
    };
    const commit = (a) => { setVal(key, a); draw(); if (key === "geral|heroCases") previewHero(); };
    wrap.addEventListener("change", (e) => { const i = e.target.dataset.i; if (i === undefined) return; const a = [...curVal(key)]; a[+i] = e.target.value; commit(a); });
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; const a = [...(curVal(key) || [])];
      if (b.dataset.add !== undefined) { const free = opts.find((o) => !a.includes(o.slug)); if (!free) return; a.push(free.slug); }
      else if (b.dataset.up) { const i = +b.dataset.up; if (!i) return; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }
      else if (b.dataset.down) { const i = +b.dataset.down; if (i >= a.length - 1) return; [a[i + 1], a[i]] = [a[i], a[i + 1]]; }
      else if (b.dataset.del) { if (a.length <= 1) { toast("Deixe pelo menos um case."); return; } a.splice(+b.dataset.del, 1); }
      commit(a);
    });
    draw(); return wrap;
  }
  async function previewHero() {
    const stage = frame() && frame().querySelector("#figStage"); if (!stage) return;
    const slugs = curVal("geral|heroCases") || [];
    await loadDocsFor(slugs.map((s) => "case:" + s));
    stage.innerHTML = slugs.map((s, i) => { const d = state.docs["case:" + s]; if (!d) return ""; const src = d.data.heroMedia && d.data.heroMedia.src; return `<img data-img="case:${s}|heroMedia.src" data-case-name="${(d.data.pt || {}).heroTitleLine1 || s}" src="${state.previews[src] || src}"${i === 0 ? ' class="on"' : ""}>`; }).join("");
  }
  function renderPagePanel() {
    const box = $("#pagePanel"); box.innerHTML = "";
    const v = $("#pageSel").value;
    if (!state.docs.geral) return;
    const pp = document.createElement("div"); pp.className = "pp";
    if (v === "home") {
      pp.innerHTML = `<h3>Configurações da home</h3>`;
      pp.appendChild(sectionsManager());
      pp.appendChild(listManager("Fotos do banner", "geral|heroCases", "As fotos do banner são as capas destes cases, na ordem. Para trocar uma foto, clique nela na página."));
      pp.appendChild(listManager("Cases na home", "geral|homeCases", "A lista de cases da home aparece atualizada depois de publicar."));
      const rv = document.createElement("div"); rv.className = "pp-sec";
      rv.innerHTML = `<b>Showreel</b><span class="small">Cole o link do YouTube ou clique no vídeo na página.</span><input type="text" id="ppReel" value="https://www.youtube.com/watch?v=${curVal("geral|reel") || ""}"><button class="b b-ghost b-block" id="ppReelOk">Trocar showreel</button>`;
      pp.appendChild(rv);
      rv.querySelector("#ppReelOk").onclick = () => {
        const id = ytId(rv.querySelector("#ppReel").value.trim()); if (!id) { toast("Não reconheci esse link do YouTube."); return; }
        setVal("geral|reel", id); const im = frame().querySelector("[data-video] img"); if (im) im.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; toast("Showreel trocado.");
      };
    } else if (v.startsWith("case:")) {
      const k = v; const d = state.docs[k]; if (!d) return;
      const slug = v.slice(5);
      const cats = ((state.docs[state.lang] || state.docs.pt || {}).data || {}).casesPage;
      const filters = cats ? cats.filters.filter((f) => f.key !== "todos") : [];
      const home = (curVal("geral|homeCases") || []).includes(slug);
      pp.innerHTML = (d.data.draft ? `<div class="draft-box"><b>Rascunho</b><span>Este case ainda não aparece no site. Edite textos, fotos e vídeos e, quando estiver aprovado, publique.</span><button class="b b-orange b-block" id="ppGoLive">Publicar este case no site</button></div>` : "") + `<h3>Configurações do case</h3>
        <div class="pp-2"><label><span class="fl">Ano</span><input type="text" id="ppYear" value="${d.data.year || ""}"></label><label><span class="fl">Endereço</span><input type="text" value="/${slug}" disabled></label></div>
        <div class="pp-sec"><b>Categorias</b><div class="chips">${filters.map((f) => `<label><input type="checkbox" value="${f.key}"${(d.data.dataService || []).includes(f.key) ? " checked" : ""}> ${f.label}</label>`).join("")}</div></div>
        <label class="chk"><input type="checkbox" id="ppHome"${home ? " checked" : ""}> Mostrar na home</label>
        <div class="pp-sec"><b>Galeria</b><span class="small">Adicione fotos ou vídeos no fim da página. Clique numa foto ou vídeo para trocar, mover ou remover.</span>
        <div class="pp-3"><button class="b b-ghost" id="ppAddImg">+ Foto</button><button class="b b-ghost" id="ppAddVid">+ Vídeo</button><button class="b b-ghost" id="ppAddTxt">+ Texto</button></div></div>
        <span class="small">Para trocar a foto de capa, clique nela no topo da página.</span>`;
      const gl = pp.querySelector("#ppGoLive");
      if (gl) gl.onclick = async () => {
        if (!(await confirmBox("Publicar o case?", "Ele passa a aparecer na página de cases, no Google e, se marcado, na home. Todas as alterações pendentes também vão ao ar.", "Publicar"))) return;
        d.data.draft = false; markDirty(k); publish();
      };
      pp.querySelector("#ppYear").onchange = (e) => { d.data.year = e.target.value.trim(); markDirty(k); };
      pp.querySelectorAll(".chips input").forEach((c) => (c.onchange = () => { d.data.dataService = [...pp.querySelectorAll(".chips input:checked")].map((x) => x.value); markDirty(k); }));
      pp.querySelector("#ppHome").onchange = (e) => { const a = [...(curVal("geral|homeCases") || [])]; const i = a.indexOf(slug); if (e.target.checked && i < 0) a.push(slug); if (!e.target.checked && i >= 0) a.splice(i, 1); setVal("geral|homeCases", a); };
      pp.querySelector("#ppAddTxt").onclick = () => addTextRow(k);
      pp.querySelector("#ppAddImg").onclick = async () => { const path = await stageUpload(await pickFile()); if (path) addGalleryRow(k, { type: "image", src: path }); };
      pp.querySelector("#ppAddVid").onclick = async () => { const link = await confirmBox("Adicionar vídeo", "Cole o link do vídeo no YouTube.", "Adicionar", ""); if (!link) return; const id = ytId(link); if (!id) { toast("Não reconheci esse link do YouTube."); return; } addGalleryRow(k, { type: "video", src: "https://youtu.be/" + id }); };
    } else return;
    box.appendChild(pp);
  }
  function addTextRow(k) {
    const d = state.docs[k]; d.data.rowsAfterApproach = d.data.rowsAfterApproach || [];
    const i = d.data.rowsAfterApproach.push({ layout: "text", title: "Título do bloco", body: "Escreva aqui o texto." }) - 1;
    markDirty(k);
    const gal = frame().querySelector(`[data-gal="${CSS.escape(k + "|rowsAfterApproach")}"]`);
    if (gal) {
      const p = `${k}|rowsAfterApproach.${i}`;
      const row = frame().createElement("div"); row.className = "gal-row gal-text rv in"; row.dataset.item = p;
      row.innerHTML = `<h3 class="h3" data-e="${p}.title">Título do bloco</h3><p data-e="${p}.body">Escreva aqui o texto.</p>`;
      gal.appendChild(row); row.scrollIntoView({ behavior: "smooth", block: "center" });
      select({ kind: "text", el: row.querySelector("h3") });
    }
    toast("Bloco de texto adicionado no fim. Use a barra preta para mudar a posição.");
  }
  function addGalleryRow(k, it) {
    const d = state.docs[k]; d.data.rowsAfterApproach = d.data.rowsAfterApproach || [];
    const i = d.data.rowsAfterApproach.push({ layout: "single", items: [it] }) - 1;
    markDirty(k);
    const gal = frame().querySelector(`[data-gal="${CSS.escape(k + "|rowsAfterApproach")}"]`);
    if (gal) {
      const row = frame().createElement("div"); row.className = "gal-row c1 rv in"; row.dataset.item = `${k}|rowsAfterApproach.${i}`;
      const ph = frame().createElement("figure"); ph.dataset.media = `${k}|rowsAfterApproach.${i}.items.0`; row.appendChild(ph); gal.appendChild(row);
      const el = paintMedia(ph, it); el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    toast("Adicionado no fim da galeria. Publique para ir ao ar.");
  }

  /* ---------- novo case ---------- */
  const slugify = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let ncCover = null; let ncAi = null;
  $("#ncAi").onclick = async () => {
    const f = $("#ncForm"); const err = (m) => { $("#ncErr").textContent = m; $("#ncErr").hidden = false; };
    $("#ncErr").hidden = true;
    if (!f.elements.name.value.trim()) return err("Escreva o nome do cliente antes de gerar.");
    if (f.context.value.trim().length < 30) return err("Escreva um contexto com pelo menos algumas frases.");
    const btn = $("#ncAi"); btn.disabled = true; btn.textContent = "Escrevendo… (até 1 minuto)";
    try {
      const r = await fetch("/api/gerar-case", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "token " + state.token },
        body: JSON.stringify({ name: f.elements.name.value.trim(), project: f.project.value.trim(), year: f.year.value.trim(), context: f.context.value.trim(), categories: [...f.querySelectorAll("#ncCats input:checked")].map((x) => x.parentNode.textContent.trim()) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não consegui gerar agora.");
      ncAi = j;
      if (!f.project.value.trim()) f.project.value = j.pt.heroTitleLine2;
      f.desc.value = j.pt.cardDesc;
      ["challengeHeading", "challengeDetail", "approachHeading", "approachDetail"].forEach((k) => (f[k].value = j.pt[k]));
      $("#ncAiOut").hidden = false; btn.textContent = "✦ Gerar de novo";
    } catch (e) { err(e.message); btn.textContent = "✦ Gerar textos com IA"; }
    btn.disabled = false;
  };
  $("#newCaseBtn").onclick = async () => {
    await loadDocsFor(["pt", "geral"]);
    const f = $("#ncForm"); f.reset(); ncCover = null; ncAi = null; $("#ncAiOut").hidden = true; $("#ncAi").textContent = "✦ Gerar textos com IA"; $("#ncCoverPrev").hidden = true; $("#ncErr").hidden = true; $("#ncUrl").textContent = "";
    const filters = state.docs.pt.data.casesPage.filters.filter((x) => x.key !== "todos");
    $("#ncCats").innerHTML = filters.map((x) => `<label><input type="checkbox" value="${x.key}"> ${x.label}</label>`).join("");
    f.year.value = new Date().getFullYear();
    $("#ncModal").hidden = false; f.elements.name.focus();
  };
  $("#ncCancel").onclick = () => ($("#ncModal").hidden = true);
  $("#ncForm").elements.name.addEventListener("input", (e) => { const f = $("#ncForm"); if (!f.slug.dataset.touched) f.slug.value = slugify(e.target.value); $("#ncUrl").textContent = "melocreative.com.br/" + (f.slug.value || ""); });
  $("#ncForm").slug.addEventListener("input", (e) => { e.target.dataset.touched = 1; e.target.value = slugify(e.target.value); $("#ncUrl").textContent = "melocreative.com.br/" + e.target.value; });
  $("#ncForm").cover.addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return; ncCover = file;
    const url = URL.createObjectURL(file); $("#ncCoverPrev").querySelector("img").src = url; $("#ncCoverPrev").hidden = false;
  });
  $("#ncForm").addEventListener("submit", (e) => {
    e.preventDefault();
    createCase(e.target).catch((x) => { $("#ncErr").textContent = "Não consegui criar: " + x.message; $("#ncErr").hidden = false; $("#ncErr").scrollIntoView({ block: "center" }); });
  });
  async function createCase(f) {
    const err = (m) => { $("#ncErr").textContent = m; $("#ncErr").hidden = false; $("#ncErr").scrollIntoView({ block: "center" }); };
    const btn = f.querySelector("button[type=submit]");
    const name = f.elements.name.value.trim(), project = f.project.value.trim(), desc = f.desc.value.trim();
    const slug = slugify(f.slug.value || name);
    if (!name || !project || !desc) return err("Preencha nome, projeto e descrição.");
    if (!ncCover) return err("Escolha uma foto de capa.");
    if (state.pages.some((p) => p.v === "case:" + slug) || ["cases", "contato", "en", "admin", "assets", "api"].includes(slug)) return err("Já existe uma página com esse endereço. Mude o endereço.");
    btn.disabled = true; btn.textContent = "Preparando…";
    const cover = await stageUpload(ncCover);
    btn.disabled = false; btn.textContent = "Criar rascunho";
    if (!cover) return err("Não consegui usar essa foto de capa. Tente outra imagem (JPG ou PNG).");
    const cats = [...f.querySelectorAll("#ncCats input:checked")].map((x) => x.value);
    const year = f.year.value.trim();
    const pt = { metaTitle: `${name}: ${project} | Melo`, metaDescription: desc, heroTitleLine1: name, heroTitleLine2: project, heroAlt: `${name}, ${project}`, tags: [project], challengeTag: "O desafio", challengeHeading: "Escreva aqui o desafio do projeto.", challengeDetail: "Conte o contexto e o problema de negócio que a empresa precisava resolver.", approachTag: "A abordagem", approachHeading: "Escreva aqui como a Melo resolveu.", approachDetail: "Conte a solução, as entregas e o resultado.", cardTitle: `${name}: ${project}`, cardDesc: desc };
    let en = { ...pt, challengeTag: "The challenge", approachTag: "The approach", tags: [project] };
    if (ncAi) {
      const edited = Object.fromEntries(["challengeHeading", "challengeDetail", "approachHeading", "approachDetail"].map((k) => [k, f[k].value.trim() || ncAi.pt[k]]));
      Object.assign(pt, ncAi.pt, edited, { heroTitleLine1: name, heroTitleLine2: project, cardDesc: desc, challengeTag: "O desafio", approachTag: "A abordagem" });
      en = { ...ncAi.en, heroTitleLine1: name, challengeTag: "The challenge", approachTag: "The approach" };
    }
    const data = { slug, draft: true, order: 99, showOnHome: false, year, dataService: cats, cardImage: cover, otherCases: [], heroMedia: { type: "image", src: cover }, rowsBeforeApproach: [], rowsAfterApproach: [], en, pt };
    const key = "case:" + slug;
    state.docs[key] = { data, sha: null, original: "" };
    if (f.home.checked) { const a = [...(curVal("geral|homeCases") || [])]; a.push(slug); setVal("geral|homeCases", a); }
    markDirty(key);
    $("#ncModal").hidden = true;
    state.openAfter = key;
    toast("Criando o rascunho. Em cerca de 1 minuto ele abre aqui para você editar.", 6000);
    await publish();
  }

  /* ---------- início ---------- */
  const tok = savedToken();
  if (tok) start(tok); else $("#login").hidden = false;
})();
