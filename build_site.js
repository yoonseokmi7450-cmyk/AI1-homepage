// 소식 글을 읽어 dist 폴더에 공개용 홈페이지를 만드는 파일입니다.
// 실행: node build_site.js (설치할 프로그램 없음)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 공개 주소가 정해지면 여기 한 곳만 바꾸세요. 예: 'https://www.주소.co.kr'
// 비워 두면 Netlify가 알려주는 주소를 쓰고, 그것도 없으면 SITE-URL로 표시합니다.
const SITE_URL = 'https://stellar-dango-2f2fd1.netlify.app'.replace(/\/$/, '') || (process.env.URL || '').replace(/\/$/, '');

const COMPANY = '(유)코리아온미래교육원';

// 검색 사이트 소유권 확인 태그. 모든 페이지의 <head>에 자동으로 들어갑니다.
const VERIFY_TAGS = [
  '<meta name="google-site-verification" content="xiawnIt8BgU4JwG_Cv42fvD1qrWCgX-bbRPYRR1bwCc" />',
];
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const POSTS = path.join(ROOT, 'content', 'posts');

const RELATED = [
  [/캠프/, 'camp.html', '캠프 프로그램 보기'],
  [/서비스교육|C\/S|CS|친절|고객 응대|민원/i, 'cs.html', '서비스교육(C/S) 내용 보기'],
  [/AI|인공지능|챗GPT|ChatGPT|생성형/i, 'ai-job.html', 'AI직무연결교육 내용 보기'],
  [/취업|진로|자기소개서|면접|중소기업/, 'career.html', '취업진로컨설팅 내용 보기'],
  [/소통|인간관계|리더십|조직/, 'communication.html', '소통 인간관계 교육 내용 보기'],
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = file => (SITE_URL ? `${SITE_URL}/${file}` : file);

function unquote(value) {
  const v = value.trim();
  if (v.length > 1 && v[0] === '"' && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (v.length > 1 && v[0] === "'" && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function parsePost(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = clean.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const data = {};
  const lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    if (/^[>|][-+]?$/.test(m[2].trim())) {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].trim());
      data[m[1]] = block.join(m[2].trim()[0] === '>' ? ' ' : '\n').trim();
    } else {
      data[m[1]] = unquote(m[2]);
    }
  }
  return { data, body: match[2].trim() };
}

function imagePath(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//.test(v)) return v;
  const p = v.replace(/^\.?\//, '');
  return p.startsWith('images/') ? p : `images/${p}`;
}

function imageExists(src) {
  return /^https?:/.test(src) || (src && fs.existsSync(path.join(ROOT, src)));
}

function inline(text) {
  return esc(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${esc(imagePath(src))}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => (/^(https?:|mailto:|tel:|[\w./#-]+$)/.test(url) && !/^javascript:/i.test(url) ? `<a href="${url}">${label}</a>` : label))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdown(source) {
  const html = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => { if (list) html.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^[-*·]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (!line) { flushPara(); flushList(); continue; }
    if (heading) { flushPara(); flushList(); const level = Math.min(heading[1].length + 1, 4); html.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flushPara(); flushList(); html.push('<hr>'); continue; }
    if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ul || ol)[1]);
      continue;
    }
    flushList();
    if (quote) { flushPara(); html.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }
    para.push(line);
  }
  flushPara();
  flushList();
  return html.join('\n');
}

function slugOf(file) {
  const name = path.basename(file, path.extname(file));
  if (/^[a-z0-9-]+$/i.test(name)) return name.toLowerCase();
  return `post-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 10)}`;
}

function loadPosts() {
  if (!fs.existsSync(POSTS)) return [];
  const posts = [];
  for (const file of fs.readdirSync(POSTS).filter(f => f.endsWith('.md'))) {
    const parsed = parsePost(fs.readFileSync(path.join(POSTS, file), 'utf8'));
    if (!parsed || !parsed.data.title) { console.warn(`건너뜀 (제목 없음): ${file}`); continue; }
    if (String(parsed.data.draft).toLowerCase() === 'true') { console.log(`임시저장이라 제외: ${file}`); continue; }
    const image = imagePath(parsed.data.image);
    if (image && !imageExists(image)) console.warn(`이미지 파일 없음: ${file} → ${image}`);
    posts.push({
      ...parsed.data,
      date: String(parsed.data.date || '').slice(0, 10),
      image: imageExists(image) ? image : '',
      body: parsed.body,
      page: `news-${slugOf(file)}.html`,
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function addNewsLinks(html) {
  if (html.includes('href="news.html"')) return html;
  return html
    .replace(/^(\s*)<li><a href="gallery\.html"([^>]*)>갤러리<\/a><\/li>/m, '$&\n$1<li><a href="news.html">소식</a></li>')
    .replace('<a href="gallery.html">갤러리</a><a href="faq.html">', '<a href="gallery.html">갤러리</a><a href="news.html">소식</a><a href="faq.html">');
}

function absoluteLinks(html) {
  if (!SITE_URL) return html;
  return html
    .replace(/(<link rel="canonical" href=")([^"#:]+)"/, `$1${SITE_URL}/$2"`)
    .replace(/(<meta property="og:url" content=")([^":]+)"/, `$1${SITE_URL}/$2"`)
    .replace(/(<meta property="og:image" content=")([^":]+)"/, `$1${SITE_URL}/$2"`)
    .replace(/("item":")([^":]+)"/g, `$1${SITE_URL}/$2"`);
}

function template() {
  const index = addNewsLinks(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')).replace(/ aria-current="page"/g, '');
  const header = index.match(/<header[\s\S]*?<\/header>/)[0];
  const footer = index.match(/<footer[\s\S]*?<\/footer>/)[0];
  const bar = index.match(/<div class="call-bar">[\s\S]*?<\/div>/)[0];
  const fonts = (index.match(/<link rel="(preconnect|stylesheet)" href="https:[^>]*>/g) || []).join('\n');
  return { header, footer, bar, fonts };
}

function page(parts, { title, description, file, image, type, jsonld, main }) {
  const share = image || 'images/og.jpg';
  const shareUrl = /^https?:/.test(share) ? share : abs(share);
  const head = parts.header.replace('<a href="news.html">소식</a>', '<a href="news.html" aria-current="page">소식</a>');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(abs(file))}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${COMPANY}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs(file))}">
<meta property="og:image" content="${esc(shareUrl)}">
<link rel="icon" type="image/png" href="images/logo.png">
${parts.fonts}
<link rel="stylesheet" href="style.css">
<script defer src="script.js"></script>
${jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld).replace(/</g, '\\u003c')}\n</script>\n` : ''}</head>
<body>
<a class="skip" href="#main">본문 바로가기</a>
${head}

<main id="main">
${main}
</main>

${parts.footer}
${parts.bar}
</body>
</html>
`;
}

function cta(title, button) {
  return `  <section class="cta">
    <div class="wrap rv">
      <h2>${title}</h2>
      <p>대상과 희망 일정을 알려주시면 가능한 구성을 안내합니다.</p>
      <div class="btn-row">
        <a class="btn btn-light" href="tel:01041678286">010-4167-8286 전화하기</a>
        ${button}
      </div>
    </div>
  </section>`;
}

function newsPage(parts, posts) {
  const cards = posts.map(p => `        <a class="news-card" href="${p.page}">
          <figure class="ph">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)} 대표 이미지" loading="lazy" onerror="this.remove()">` : ''}</figure>
          <div class="news-body">
            <p class="news-meta">${p.category ? `<span>${esc(p.category)}</span>` : ''}${p.date ? `<time datetime="${esc(p.date)}">${esc(p.date.replace(/-/g, '.'))}</time>` : ''}</p>
            <h2>${esc(p.title)}</h2>
            ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
          </div>
        </a>`).join('\n');
  const main = `  <section class="page-head">
    <div class="wrap">
      <ol class="crumb"><li><a href="index.html">홈</a></li><li>소식</li></ol>
      <span class="over">NEWS</span>
      <h1>소식</h1>
      <p class="lead">${COMPANY}의 소식을 전합니다.</p>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      ${posts.length ? `<div class="news-grid">\n${cards}\n      </div>` : '<p class="lead">아직 등록된 소식이 없습니다.</p>'}
    </div>
  </section>

${cta('궁금한 교육이 있으신가요?', '<a class="btn btn-line" href="services.html">교육 서비스 확인하기</a>')}`;
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈', item: abs('index.html') },
    { '@type': 'ListItem', position: 2, name: '소식', item: abs('news.html') },
  ] };
  return page(parts, { title: `소식 | ${COMPANY}`, description: `${COMPANY}의 소식을 모았습니다.`, file: 'news.html', type: 'website', jsonld: breadcrumb, main });
}

function postPage(parts, post) {
  const text = `${post.title} ${post.summary || ''} ${post.body}`;
  const related = RELATED.find(([re]) => re.test(text));
  const [href, label] = related ? related.slice(1) : ['services.html', '교육 서비스 확인하기'];
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title };
  if (post.date) article.datePublished = post.date;
  if (post.summary) article.description = post.summary;
  if (post.image) article.image = /^https?:/.test(post.image) ? post.image : abs(post.image);
  article.publisher = { '@type': 'Organization', name: COMPANY };
  const main = `  <section class="page-head">
    <div class="wrap">
      <ol class="crumb crumb--arrow"><li><a href="index.html">홈</a></li><li><a href="news.html">소식</a></li><li>${esc(post.title)}</li></ol>
      <span class="over">${esc(post.category || 'NEWS')}</span>
      <h1>${esc(post.title)}</h1>
      ${post.date ? `<p class="lead"><time datetime="${esc(post.date)}">${esc(post.date.replace(/-/g, '.'))}</time></p>` : ''}
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <article class="post">
        ${post.image ? `<img class="post-cover" src="${esc(post.image)}" alt="${esc(post.title)} 대표 이미지" onerror="this.remove()">` : ''}
        ${markdown(post.body)}
      </article>
      <div class="post-more">
        <a class="go" href="${href}">${label} <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        <a class="go" href="news.html">소식 목록으로 돌아가기 <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>
    </div>
  </section>

${cta('이 글과 관련된 교육이 궁금하신가요?', `<a class="btn btn-line" href="contact.html">문의 방법 확인하기</a>`)}`;
  return page(parts, {
    title: `${post.title} | ${COMPANY}`,
    description: post.summary || post.title,
    file: post.page,
    image: post.image,
    type: 'article',
    jsonld: article,
    main,
  });
}

function copyAssets() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);
  for (const name of fs.readdirSync(ROOT)) {
    if (/\.(html|css|js|txt)$/.test(name) && name !== 'build_site.js' && name !== 'news.css') fs.copyFileSync(path.join(ROOT, name), path.join(DIST, name));
  }
  fs.cpSync(path.join(ROOT, 'images'), path.join(DIST, 'images'), { recursive: true, filter: src => !src.endsWith('.txt') });
  fs.cpSync(path.join(ROOT, 'admin'), path.join(DIST, 'admin'), { recursive: true });
}

function build() {
  copyAssets();
  const posts = loadPosts();
  const parts = template();

  for (const name of fs.readdirSync(DIST).filter(f => f.endsWith('.html'))) {
    const file = path.join(DIST, name);
    fs.writeFileSync(file, absoluteLinks(addNewsLinks(fs.readFileSync(file, 'utf8'))));
  }
  fs.appendFileSync(path.join(DIST, 'style.css'), fs.readFileSync(path.join(ROOT, 'news.css'), 'utf8'));
  fs.writeFileSync(path.join(DIST, 'news.html'), newsPage(parts, posts));
  for (const post of posts) fs.writeFileSync(path.join(DIST, post.page), postPage(parts, post));

  for (const name of fs.readdirSync(DIST).filter(f => f.endsWith('.html'))) {
    const file = path.join(DIST, name);
    const html = fs.readFileSync(file, 'utf8');
    const tags = VERIFY_TAGS.filter(t => !html.includes(t)).join('\n');
    if (tags) fs.writeFileSync(file, html.replace(/<head>/i, `<head>\n${tags}`));
  }

  const base = SITE_URL || 'https://SITE-URL';
  const pages = fs.readdirSync(DIST).filter(f => f.endsWith('.html')).sort();
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${base}/${p}</loc></url>`).join('\n')}
</urlset>
`);
  if (SITE_URL) {
    const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
    fs.writeFileSync(path.join(DIST, 'robots.txt'), robots.replace(/^# \[배포 후 입력\].*\n/m, '').replace(/^# Sitemap: https:\/\/SITE-URL/m, `Sitemap: ${SITE_URL}`));
  }
  console.log(`완료: 글 ${posts.length}개, 페이지 ${pages.length}개를 dist 폴더에 만들었습니다.`);
}

build();
