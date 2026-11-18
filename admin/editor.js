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
  const confirmBox = (title, text, yes = "Confirmar") => new Promise((res) => {
    $("#modalTitle").textContent = title; $("#modalText").textContent = text; $("#modalYes").textContent = yes; $("#modal").hidden = false;
    const done = (v) => { $("#modal").hidden = true; $("#modalYes").onclick = $("#modalNo").onclick = null; res(v); };
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
    const keys = [...doc.querySelectorAll("[data-e],[data-img],[data-item]")].map((el) => split(el.dataset.e || el.dataset.img || el.dataset.item)[0]);
    await loadDocsFor(keys);
    paintAll();
    $("#frameLoading").hidden = true;
  });

  function injectFrame(doc) {
    const st = doc.createElement("style");
    st.textContent = `
      .rv,.fade{opacity:1!important;transform:none!important}
      [data-e],[data-img]{cursor:text;outline:1px dashed transparent;outline-offset:3px;transition:outline-color .12s}
      [data-img]{cursor:pointer}
      [data-e]:hover,[data-img]:hover{outline-color:#f66324!important}
      [data-e].mel-sel,[data-img].mel-sel{outline:2px solid #f66324!important;outline-offset:3px}
      [data-e][contenteditable]{cursor:text;caret-color:#f66324}
      [data-e]:empty::before{content:"(vazio)";opacity:.4}
      .mel-item{outline:1px solid rgba(246,99,36,.35);outline-offset:6px}
      .mel-changed{box-shadow:inset 0 -2px 0 rgba(246,99,36,.55)}
      a{cursor:default}
    `;
    doc.head.appendChild(st);
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
  const isMultiline = (el) => /(\.d|\.a|\.lead|\.text|Detail|\.about)$/.test(split(el.dataset.e)[1]);

  function onFrameClick(e) {
    const t = e.target;
    const txt = t.closest("[data-e]");
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
  const ITEM_NAMES = { faq: "Pergunta do FAQ", reviews: "Avaliação", meta: "Dado do banner", "contactSec.info": "Informação de contato", services: "Serviço", l: "Entrega" };
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
    const key = kind === "text" ? el.dataset.e : el.dataset.img;
    const item = el.closest("[data-item]");
    state.sel = { kind, key, el, item: item ? item.dataset.item : null };
    if (item) item.classList.add("mel-item");
    const [crumb, name] = labelFor(key);
    $("#crumbs").textContent = crumb; $("#fieldName").textContent = name;
    $("#sideEmpty").hidden = true; $("#sideEdit").hidden = false;
    $("#textBox").hidden = kind !== "text"; $("#imgBox").hidden = kind !== "img";
    if (kind === "text") {
      if (!el.isContentEditable) { el.setAttribute("contenteditable", "plaintext-only"); if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true"); }
      el.focus();
      const [f, p] = split(key); const v = getP((state.docs[f] || {}).data || {}, p);
      $("#fieldText").value = typeof v === "string" ? v : el.innerText;
      $("#fieldText").rows = isMultiline(el) ? 7 : 2;
      countChars();
      $("#revertBtn").hidden = !isChanged(key);
    } else {
      const [f, p] = split(key); const v = getP((state.docs[f] || {}).data || {}, p) || el.getAttribute("src");
      $("#imgPath").value = v; $("#imgPrev").src = state.previews[v] || v;
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
    if (file.size > 5 * 1024 * 1024) { toast("Imagem acima de 5 MB. Reduza o tamanho e tente de novo."); return; }
    const dataURL = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    const clean = file.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
    const publicPath = `/assets/img/uploads/${Date.now()}-${clean}`;
    state.uploads[publicPath.slice(1)] = dataURL.split(",")[1];
    state.previews[publicPath] = dataURL;
    const [f, p] = split(state.sel.key); setP(state.docs[f].data, p, publicPath); markDirty(f);
    $("#imgPath").value = publicPath; $("#imgPrev").src = dataURL; paintAll();
    toast("Imagem trocada. Ela vai para o site quando você publicar.");
  });

  /* ---------- itens de lista ---------- */
  document.querySelectorAll("#itemBox [data-op]").forEach((b) => b.addEventListener("click", async () => {
    if (!state.sel || !state.sel.item) return;
    const op = b.dataset.op;
    const [file, ipath] = split(state.sel.item);
    const idx = +ipath.split(".").pop();
    const arrPath = ipath.replace(/\.\d+$/, "");
    const d = state.docs[file]; const arr = getP(d.data, arrPath);
    if (!Array.isArray(arr)) return;
    if (op === "del") {
      if (arr.length <= 1) { toast("A lista precisa ter pelo menos um item."); return; }
      if (!(await confirmBox("Remover item?", "O item sai da página quando você publicar. Dá para desfazer com 'Descartar' antes de publicar.", "Remover"))) return;
    }
    const doc = frame();
    const prefix = `${file}|${arrPath}.`;
    const siblings = () => [...doc.querySelectorAll(`[data-item]`)].filter((n) => n.dataset.item.startsWith(prefix) && /^\d+$/.test(n.dataset.item.slice(prefix.length)));
    const node = siblings().find((n) => n.dataset.item === state.sel.item);
    let target = idx;
    if (op === "up") { if (idx === 0) return; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; target = idx - 1; if (node && node.previousElementSibling) node.parentNode.insertBefore(node, node.previousElementSibling); }
    if (op === "down") { if (idx >= arr.length - 1) return; [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; target = idx + 1; if (node && node.nextElementSibling) node.parentNode.insertBefore(node.nextElementSibling, node); }
    if (op === "dup") { arr.splice(idx + 1, 0, JSON.parse(JSON.stringify(arr[idx]))); target = idx + 1; if (node) node.after(node.cloneNode(true)); }
    if (op === "del") { arr.splice(idx, 1); target = -1; if (node) node.remove(); }
    // renumera os índices na prévia
    siblings().forEach((n, i) => {
      const from = n.dataset.item, to = prefix + i;
      if (from === to) return;
      [n, ...n.querySelectorAll("[data-item],[data-e],[data-img]")].forEach((x) => {
        ["item", "e", "img"].forEach((a) => { const v = x.dataset[a]; if (v && (v === from || v.startsWith(from + "."))) x.dataset[a] = to + v.slice(from.length); });
      });
    });
    markDirty(file);
    deselect();
    if (target >= 0) {
      const n = doc.querySelector(`[data-item="${CSS.escape(prefix + target)}"]`);
      const first = n && n.querySelector("[data-e]");
      if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); select({ kind: "text", el: first }); }
    }
    toast(op === "del" ? "Item removido." : op === "dup" ? "Item duplicado. Edite o texto da cópia." : "Ordem alterada.");
  }));

  /* ---------- publicar ---------- */
  async function publish() {
    const files = [...state.dirty];
    const ups = Object.entries(state.uploads);
    if (!files.length && !ups.length) return;
    $("#publishBtn").disabled = true; setStatus("Publicando…", "work");
    try {
      // confere se ninguém mudou os arquivos no meio do caminho
      for (const k of files) {
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
        if (st.state === "success") { setStatus("No ar. Site atualizado.", "ok"); toast("Publicado! O site já está atualizado."); state.previews = {}; saveDraft(); openPage($("#pageSel").value, true); return; }
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

  /* ---------- início ---------- */
  const tok = savedToken();
  if (tok) start(tok); else $("#login").hidden = false;
})();
