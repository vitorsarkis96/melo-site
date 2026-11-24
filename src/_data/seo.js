// SEO e GEO: dados estruturados (schema.org) do posicionamento atual.
// Agência de comunicação corporativa que traduz autoridade técnica em autoridade de marca.
const site = require("./site.json");
const geral = require("./conteudo/geral.json");

const BASE = site.baseUrl;
const ORG = `${BASE}/#organizacao`;
const WEB = `${BASE}/#site`;

const txt = {
  pt: {
    desc: "Agência de comunicação corporativa em São Paulo que traduz autoridade técnica em autoridade de marca. Estratégia, marca, cultura, comunicação institucional, sites e audiovisual sob uma única direção, para empresas de saúde, tecnologia, direito, educação e indústria.",
    slogan: "Traduzimos autoridade técnica em autoridade de marca.",
    services: [
      ["Estratégia e posicionamento", "Diagnóstico de percepção, posicionamento, arquitetura de marca, plano de comunicação, mensagens-chave e metas."],
      ["Marca e identidade", "Identidade visual e verbal, tom de voz, manual de marca e rebranding para empresas técnicas."],
      ["Cultura e comunicação interna", "Narrativa de valores, manifesto em vídeo, campanhas internas e onboarding."],
      ["Comunicação institucional", "Apresentações, catálogos, relatórios institucionais, materiais para eventos e comunicação com investidores."],
      ["Sites e sistemas", "Sites institucionais, landing pages, integrações HubSpot, plataformas sob medida e SEO."],
      ["Audiovisual", "Vídeos institucionais, captação, fotografia, motion design e edição."],
    ],
    home: "Início",
    cases: "Cases",
    contact: "Contato",
  },
  en: {
    desc: "Corporate communications agency in São Paulo, Brazil, that turns technical authority into brand authority. Strategy, brand, culture, institutional communication, websites and film under one direction, for healthcare, technology, law, education and industrial companies.",
    slogan: "We turn technical authority into brand authority.",
    services: [
      ["Strategy and positioning", "Perception audit, positioning, brand architecture, communication plan, key messages and goals."],
      ["Brand and identity", "Visual and verbal identity, tone of voice, brand guidelines and rebranding for technical companies."],
      ["Culture and internal communication", "Values narrative, video manifesto, internal campaigns and onboarding."],
      ["Institutional communication", "Decks, catalogs, institutional reports, event materials and investor communication."],
      ["Websites and systems", "Corporate websites, landing pages, HubSpot integrations, custom platforms and SEO."],
      ["Film", "Corporate videos, shooting, photography, motion design and editing."],
    ],
    home: "Home",
    cases: "Cases",
    contact: "Contact",
  },
};

const sameAs = [site.instagram, site.linkedin, geral.social.facebook, geral.social.linktree, geral.social.upwork, geral.social.maps].filter(Boolean);

function org(lang) {
  const t = txt[lang] || txt.pt;
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG,
    name: "Melo Creative",
    alternateName: ["Melo", "Melo Agência de Comunicação Corporativa"],
    legalName: site.legalName,
    taxID: site.cnpj,
    url: `${BASE}/`,
    logo: { "@type": "ImageObject", url: `${BASE}/assets/icons/favicon-512x512.png` },
    image: `${BASE}/assets/img/cases/mev-hero-folder.jpg`,
    description: t.desc,
    slogan: t.slogan,
    foundingDate: "2020",
    email: site.email,
    telephone: "+55-11-95438-7151",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Rua Conde do Pinhal, 8",
      addressLocality: "São Paulo",
      addressRegion: "SP",
      addressCountry: "BR",
    },
    areaServed: [{ "@type": "Country", name: "Brasil" }, { "@type": "Place", name: "Worldwide" }],
    knowsAbout: [
      "Comunicação corporativa", "Corporate communications", "Autoridade de marca", "Brand authority",
      "Posicionamento de marca", "Branding", "Identidade visual", "Comunicação institucional",
      "Comunicação interna", "Cultura organizacional", "Sites institucionais", "Produção audiovisual",
      "Marketing B2B", "Comunicação para empresas de saúde", "Comunicação para empresas de tecnologia",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: lang === "en" ? "Corporate communications services" : "Serviços de comunicação corporativa",
      itemListElement: t.services.map(([name, description]) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name, description, provider: { "@id": ORG } },
      })),
    },
    sameAs,
  };
}

function graph(p) {
  const lang = p.lang === "en" ? "en" : "pt";
  const t = txt[lang];
  const inLang = lang === "en" ? "en" : "pt-BR";
  const homeUrl = lang === "en" ? `${BASE}/en/` : `${BASE}/`;
  const nodes = [
    org(lang),
    { "@type": "WebSite", "@id": WEB, url: `${BASE}/`, name: "Melo Creative", alternateName: ["Melo", "melocreative.com.br"], description: t.desc, publisher: { "@id": ORG }, inLanguage: ["pt-BR", "en"] },
  ];
  const page = {
    "@type": p.pageType || "WebPage",
    "@id": `${p.url}#pagina`,
    url: p.url,
    name: p.title,
    description: p.description,
    inLanguage: inLang,
    isPartOf: { "@id": WEB },
    about: { "@id": ORG },
    primaryImageOfPage: p.image ? { "@type": "ImageObject", url: p.image } : undefined,
  };
  nodes.push(page);
  const crumbs = [[t.home, homeUrl]];
  if (p.kind === "cases" || p.kind === "case") crumbs.push([t.cases, lang === "en" ? `${BASE}/en/cases` : `${BASE}/cases`]);
  if (p.kind === "contact") crumbs.push([t.contact, p.url]);
  if (p.kind === "case") crumbs.push([p.caseName, p.url]);
  if (crumbs.length > 1) {
    const bc = {
      "@type": "BreadcrumbList",
      "@id": `${p.url}#trilha`,
      itemListElement: crumbs.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
    };
    nodes.push(bc);
    page.breadcrumb = { "@id": bc["@id"] };
  }
  if (p.kind === "case") {
    nodes.push({
      "@type": "CreativeWork",
      "@id": `${p.url}#case`,
      name: p.title,
      headline: p.caseName,
      description: p.description,
      url: p.url,
      image: p.image,
      inLanguage: inLang,
      dateCreated: p.year ? String(p.year) : undefined,
      keywords: (p.tags || []).join(", "),
      creator: { "@id": ORG },
      publisher: { "@id": ORG },
      about: { "@type": "Organization", name: p.caseName },
    });
  }
  return { "@context": "https://schema.org", "@graph": nodes };
}

module.exports = { graph, txt };
