document.documentElement.classList.add('js');

/* 상단 메뉴: 스크롤하면 유리 배경 */
const head = document.querySelector('.site-head');
const stick = () => head.classList.toggle('is-stuck', scrollY > 12);
addEventListener('scroll', stick, { passive: true });
stick();

/* 모바일 메뉴 */
const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuBtn.setAttribute('aria-expanded', open);
});

/* 첫 화면: images/hero.mp4 또는 hero.jpg가 있으면 자동으로 표시 */
const hero = document.querySelector('.hero');
if (hero) {
  const video = hero.querySelector('#hero-bg video');
  const photo = hero.querySelector('#hero-bg img');
  const show = el => { el.classList.add('is-on'); hero.classList.add('hero--media'); };
  if (video) {
    if (video.readyState >= 2) show(video);
    else video.addEventListener('loadeddata', () => show(video));
  }
  if (photo) {
    if (photo.complete && photo.naturalWidth) show(photo);
    else photo.addEventListener('load', () => show(photo));
  }
}

/* 스크롤 등장: 같은 묶음 안에서 0.08초 간격 */
document.querySelectorAll('.stagger').forEach(group => {
  [...group.children].forEach((el, i) => {
    el.classList.add('rv');
    el.style.setProperty('--i', i);
  });
});

/* 숫자 카운트업: 입력된 실제 숫자만 data-count에 넣음 */
const countUp = el => {
  const end = +el.dataset.count;
  const unit = el.dataset.unit || '';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = end + unit; return; }
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / 1000, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3))) + unit;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

if ('IntersectionObserver' in window) {
  const show = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      show.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach(el => show.observe(el));

  const counts = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      counts.unobserve(entry.target);
    });
  }, { threshold: .5 });
  document.querySelectorAll('[data-count]').forEach(el => counts.observe(el));
} else {
  document.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
}

/* 갤러리: 사진을 누르면 크게 보기, 화살표·밀기로 넘기기, 닫기 */
const galleries = document.querySelectorAll('[data-lightbox]');
if (galleries.length) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', '사진 크게 보기');
  box.innerHTML = '<img alt=""><p class="lb-count"></p>' +
    '<button type="button" class="lb-btn lb-close" aria-label="닫기">×</button>' +
    '<button type="button" class="lb-btn lb-prev" aria-label="이전 사진">‹</button>' +
    '<button type="button" class="lb-btn lb-next" aria-label="다음 사진">›</button>';
  document.body.append(box);

  const big = box.querySelector('img');
  const count = box.querySelector('.lb-count');
  let photos = [];
  let index = 0;
  let opener = null;
  let startX = 0;

  const showPhoto = i => {
    index = (i + photos.length) % photos.length;
    big.src = photos[index].src;
    big.alt = photos[index].alt;
    count.textContent = (index + 1) + ' / ' + photos.length;
  };
  const closeBox = () => {
    box.hidden = true;
    big.removeAttribute('src');
    document.body.style.overflow = '';
    if (opener) opener.focus();
  };

  galleries.forEach(gallery => {
    const items = [...gallery.querySelectorAll('.gal-item')];
    items.forEach((item, i) => item.addEventListener('click', () => {
      photos = items.map(el => el.querySelector('img'));
      opener = item;
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      showPhoto(i);
      box.querySelector('.lb-close').focus();
    }));
  });

  box.querySelector('.lb-close').addEventListener('click', closeBox);
  box.querySelector('.lb-prev').addEventListener('click', () => showPhoto(index - 1));
  box.querySelector('.lb-next').addEventListener('click', () => showPhoto(index + 1));
  box.addEventListener('click', e => { if (e.target === box) closeBox(); });
  box.addEventListener('touchstart', e => { startX = e.changedTouches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => {
    const moved = e.changedTouches[0].clientX - startX;
    if (Math.abs(moved) > 50) showPhoto(index + (moved < 0 ? 1 : -1));
  });
  addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'Escape') closeBox();
    if (e.key === 'ArrowLeft') showPhoto(index - 1);
    if (e.key === 'ArrowRight') showPhoto(index + 1);
  });
}

/* 사진이 스크롤보다 천천히 움직이는 효과 (휴대폰과 움직임 줄이기 설정에서는 끔) */
const slowPhotos = [...document.querySelectorAll('[data-parallax]')];
if (slowPhotos.length && innerWidth > 900 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let waiting = false;
  const moveAll = () => {
    waiting = false;
    slowPhotos.forEach(photo => {
      const box = photo.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return;
      const center = (box.top + box.height / 2 - innerHeight / 2) / innerHeight;
      photo.style.setProperty('--py', (center * -36).toFixed(1) + 'px');
    });
  };
  addEventListener('scroll', () => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(moveAll);
  }, { passive: true });
  moveAll();
}

/* 버튼 효과: 마우스를 올리면 글자가 올라가고 아이콘이 나오며, 위에 말풍선을 보여줌.
   말풍선 문구는 아래 tip에서 정합니다. */
const swapIcons = {
  tel: '<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a3 3 0 0 1-3 3A15 15 0 0 1 3 6a3 3 0 0 1 3-3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  go: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
document.querySelectorAll('.btn,.channel').forEach(button => {
  const href = button.getAttribute('href') || '';
  const type = href.startsWith('tel:') ? 'tel' : href.startsWith('mailto:') ? 'mail' : /^https?:/.test(href) ? 'out' : 'go';
  const tip = { tel: '010-4167-8286', mail: 'ysm8285@nate.com', out: '새 창으로 열기', go: '페이지로 이동' }[type];
  const label = document.createElement('span');
  label.className = 'swap-text';
  label.append(...button.childNodes);
  const clip = document.createElement('span');
  clip.className = 'swap-clip';
  clip.append(label);
  clip.insertAdjacentHTML('beforeend', `<span class="swap-icon" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24">${swapIcons[type]}</svg></span>`);
  button.append(clip);
  button.dataset.tooltip = tip;
  button.classList.add('swap');
});

/* 곡선 글자: 문구 한 묶음 길이만큼 흐른 뒤 이어지게 맞춤 */
const pathBand = document.querySelector('.text-path svg');
if (pathBand) {
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    const text = pathBand.querySelector('text');
    pathBand.querySelector('animate').setAttribute('to', -text.getComputedTextLength() / 10);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) pathBand.pauseAnimations();
  });
}

/* 곡선 글자: 스크롤하면 물결이 더 휘고, 멈추면 원래 모양으로 돌아옴
   내려갈 때는 더 크게, 올라갈 때는 반대로 휨 (움직임 줄이기 설정에서는 끔) */
if (pathBand && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const line = pathBand.querySelector('#wave-line');
  let lastScroll = scrollY;
  let goal = 1;
  let bend = 1;
  let running = false;
  const draw = () => {
    bend += (goal - bend) * 0.14;
    goal += (1 - goal) * 0.07;
    const top = (86 - 70 * bend).toFixed(1);
    line.setAttribute('d', `M-40 86 Q140 ${top} 320 86 T680 86 T1040 86 T1400 86 T1760 86`);
    if (Math.abs(bend - 1) > 0.003 || Math.abs(goal - 1) > 0.003) requestAnimationFrame(draw);
    else running = false;
  };
  addEventListener('scroll', () => {
    const moved = scrollY - lastScroll;
    lastScroll = scrollY;
    const box = pathBand.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;
    goal = Math.min(1.7, Math.max(-0.7, 1 + moved / 45));
    if (!running) {
      running = true;
      requestAnimationFrame(draw);
    }
  }, { passive: true });
}
