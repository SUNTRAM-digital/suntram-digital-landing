// Local dev server for suntram-digital-landing with a /site JSON endpoint.
// Run: node dev-server.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 4174;
const HOST = process.env.HOST || '127.0.0.1';

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ');
}

function clean(s) {
  return stripTags(String(s || '')).replace(/\s+/g, ' ').trim();
}

function match1(re, s) {
  const m = re.exec(s);
  return m ? m[1] : '';
}

function matchAll(re, s, mapFn) {
  const out = [];
  let m;
  while ((m = re.exec(s))) out.push(mapFn(m));
  return out;
}

function buildSiteJson({ pretty = false } = {}) {
  const html = readText(path.join(ROOT, 'index.html'));

  const title = clean(match1(/<title>([\s\S]*?)<\/title>/i, html));
  const description = match1(/<meta\s+name="description"\s+content="([^"]*)"\s*\/>/i, html);

  const ogTitle = match1(/<meta\s+property="og:title"\s+content="([^"]*)"\s*\/>/i, html);
  const ogDescription = match1(/<meta\s+property="og:description"\s+content="([^"]*)"\s*\/>/i, html);
  const ogType = match1(/<meta\s+property="og:type"\s+content="([^"]*)"\s*\/>/i, html);

  const brandName = clean(match1(/<span\s+class="brand__word">([\s\S]*?)<\/span>/i, html)) || 'SUNTRAM Digital';
  const logo = match1(/<img\s+class="brand__logo"\s+src="([^"]+)"/i, html) || 'assets/logo-suntram.png';

  // Nav links (robust extraction)
  const navStart = html.toLowerCase().indexOf('id="nav-links"');
  let navigation = [];
  if (navStart !== -1) {
    const slice = html.slice(navStart, navStart + 2000); // enough for the nav links block
    navigation = matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, slice, (m) => ({
      href: m[1],
      label: clean(m[2]),
    }));
  }

  // Hero
  const heroKicker = clean(match1(/<p\s+class="kicker"[^>]*>([\s\S]*?)<\/p>/i, html));
  const heroH1 = clean(match1(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html));
  const heroLead = clean(match1(/<p\s+class="lead"[^>]*>([\s\S]*?)<\/p>/i, html));
  // Hero pillars (extract within hero trust block)
  const trustStart = html.toLowerCase().indexOf('class="hero__trust"');
  let heroPillars = [];
  if (trustStart !== -1) {
    const slice = html.slice(trustStart, trustStart + 1200);
    heroPillars = matchAll(/<div\s+class="pill">([\s\S]*?)<\/div>/gi, slice, (m) => clean(m[1]));
  }

  // Metrics (scan the full doc; structure is stable enough)
  const heroMetrics = matchAll(/<div\s+class="metric">([\s\S]*?)<\/div>\s*<\/div>/gi, html, (m) => {
    const block = m[1];
    const value = match1(/data-count-to="([0-9]+)"/i, block);
    const label = clean(match1(/<div\s+class="metric__label">([\s\S]*?)<\/div>/i, block));
    return { value, label };
  }).filter(x => x.value || x.label);

  // Services
  const servicesBlock = match1(/<section\s+class="section"\s+id="servicios">([\s\S]*?)<\/section>/i, html);
  const services = matchAll(/<article\s+class="service[\s\S]*?data-service="([^"]+)"[\s\S]*?<\/article>/gi, servicesBlock, (m) => {
    const card = m[0];
    const key = m[1];
    const name = clean(match1(/<h3>([\s\S]*?)<\/h3>/i, card));
    const desc = clean(match1(/<h3>[\s\S]*?<\/h3>\s*<p>([\s\S]*?)<\/p>/i, card));
    const listBlock = match1(/<ul\s+class="serviceList">([\s\S]*?)<\/ul>/i, card);
    const highlights = matchAll(/<li>([\s\S]*?)<\/li>/gi, listBlock, (mm) => clean(mm[1]));
    return { key, name, description: desc, highlights };
  });

  // AI
  const aiBlock = match1(/<section\s+class="section section--alt"\s+id="ai">([\s\S]*?)<\/section>/i, html);
  const aiSolutions = matchAll(/<article\s+class="aiCard">([\s\S]*?)<\/article>/gi, aiBlock, (m) => {
    const card = m[1];
    const name = clean(match1(/<h3>([\s\S]*?)<\/h3>/i, card));
    const desc = clean(match1(/<p>([\s\S]*?)<\/p>/i, card));
    const tagsBlock = match1(/<div\s+class="aiTags">([\s\S]*?)<\/div>/i, card);
    const tags = matchAll(/<span>([\s\S]*?)<\/span>/gi, tagsBlock, (mm) => clean(mm[1]));
    return { name, description: desc, tags };
  });

  // Process
  const processBlock = match1(/<section\s+class="section"\s+id="proceso">([\s\S]*?)<\/section>/i, html);
  const stepsBlock = match1(/<ol[^>]*class="steps"[^>]*>[\s\S]*?<\/ol>/i, processBlock);
  const process = matchAll(/<li>[\s\S]*?<\/li>/gi, stepsBlock, (m) => {
    const li = m[0];
    const step = clean(match1(/<div\s+class="step__num">([\s\S]*?)<\/div>/i, li));
    const title2 = clean(match1(/<h3>([\s\S]*?)<\/h3>/i, li));
    const desc2 = clean(match1(/<h3>[\s\S]*?<\/h3>\s*<p>([\s\S]*?)<\/p>/i, li));
    return { step, title: title2, description: desc2 };
  }).filter(x => x.step || x.title);

  // Contact direct
  const contactBlock = match1(/<section\s+class="section section--alt"\s+id="contacto">([\s\S]*?)<\/section>/i, html);
  const emailHref = match1(/href="(mailto:[^"]+)"/i, contactBlock);
  const telHref = match1(/href="(tel:[^"]+)"/i, contactBlock);

  // Footer links
  const footerBlock = match1(/<div\s+class="footer__links">([\s\S]*?)<\/div>/i, html);
  const footerLinks = matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, footerBlock, (m) => ({
    href: m[1],
    label: clean(m[2]),
  }));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    site: {
      name: brandName,
      title,
      description,
      logo,
      language: 'es',
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: ogType,
    },
    navigation,
    hero: {
      kicker: heroKicker,
      headline: heroH1,
      lead: heroLead,
      pillars: heroPillars,
      metrics: heroMetrics,
    },
    services,
    aiSolutions,
    process,
    contact: { email: emailHref, tel: telHref },
    footerLinks,
    source: {
      indexHtml: '/index.html',
      endpoint: '/site',
      notes: 'Local dev summary (regex-based). Production version is intended to be PHP on Hostinger.',
    },
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && u.pathname === '/site') {
      const pretty = u.searchParams.get('pretty');
      const json = buildSiteJson({ pretty: pretty === '1' || (pretty || '').toLowerCase() === 'true' });
      const body = JSON.stringify(json, null, (pretty === '1' || (pretty || '').toLowerCase() === 'true') ? 2 : 0);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }

    // Static file serving
    let filePath = decodeURIComponent(u.pathname);
    if (filePath === '/' || filePath === '') filePath = '/index.html';

    const safePath = path.normalize(filePath).replace(/^([A-Za-z]:)?[\\/]+/, '');
    const abs = path.join(ROOT, safePath);

    if (!abs.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const buf = fs.readFileSync(abs);
    res.writeHead(200, { 'Content-Type': contentType(abs) });
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(e && e.stack ? e.stack : e));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`suntram dev server: http://${HOST}:${PORT}`);
  console.log(`JSON endpoint:      http://${HOST}:${PORT}/site?pretty=1`);
});
