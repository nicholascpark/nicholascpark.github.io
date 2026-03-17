/**
 * Site renderer — reads nicholas.yaml (source of truth) and
 * outputs/site-content.yaml (generated prose), renders the page into #root.
 *
 * Dependencies: js-yaml (loaded via CDN in index.html)
 */

/* --- Theme detection --- */

function isDarkMode() {
  // Default to light — only dark if explicitly chosen
  return localStorage.getItem('theme') === 'dark';
}

// Apply theme immediately to avoid flash
if (isDarkMode()) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

(async function () {
  const root = document.getElementById('root');
  root.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const [nicholas, siteContent] = await Promise.all([
      fetchYAML('nicholas.yaml'),
      fetchYAML('outputs/site-content.yaml'),
    ]);

    root.innerHTML = '';
    root.appendChild(wrapGlass(renderHeader(nicholas), 'glass-card-header'));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderAbout(siteContent)));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderInterests(nicholas)));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderProjects(nicholas)));
    root.appendChild(renderFooter(nicholas));

    // Scroll-triggered reveals
    initScrollReveals();
    // Mouse proximity glow tracking
    initMouseGlow();
    // Subtle content parallax
    initParallax();
  } catch (err) {
    console.error('Failed to render site:', err);
    root.innerHTML = '<p class="loading">Failed to load. Please try refreshing.</p>';
  }
})();

/* --- Data fetching --- */

async function fetchYAML(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  const text = await response.text();
  return jsyaml.load(text);
}

/* --- Sacred geometry divider --- */

function createSacredDivider() {
  const divider = el('div', 'section-divider reveal');

  // Small sacred geometry symbol — a simplified Seed of Life / hexagram
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '0.8');

  // Central circle
  const c1 = document.createElementNS(svgNS, 'circle');
  c1.setAttribute('cx', '12');
  c1.setAttribute('cy', '12');
  c1.setAttribute('r', '4');
  svg.appendChild(c1);

  // Outer ring
  const c2 = document.createElementNS(svgNS, 'circle');
  c2.setAttribute('cx', '12');
  c2.setAttribute('cy', '12');
  c2.setAttribute('r', '9');
  svg.appendChild(c2);

  // Diamond / rotated square inside
  const diamond = document.createElementNS(svgNS, 'polygon');
  diamond.setAttribute('points', '12,3 21,12 12,21 3,12');
  svg.appendChild(diamond);

  divider.appendChild(svg);
  return divider;
}

/* --- Render functions --- */

function renderHeader(profile) {
  const header = el('header', 'site-header reveal');

  header.appendChild(elText('h1', profile.name));

  // Tagline — typed in after header reveals
  const TAGLINE_TEXT = 'Software Engineer \u00b7 AI Agents \u00b7 Applied Cognition';
  const tagline = el('p', 'tagline');
  tagline.setAttribute('aria-label', TAGLINE_TEXT);
  header.appendChild(tagline);

  // After header reveal: typewriter + toggle entrance + ripple
  header.addEventListener('transitionend', function onReveal(e) {
    if (e.target !== header) return;
    header.removeEventListener('transitionend', onReveal);
    typewrite(tagline, TAGLINE_TEXT);
    toggle.classList.remove('toggle-hidden');
    spawnLoadRipple(toggle);
  });

  // Links row
  const links = el('nav', 'links-row');
  const linkData = [
    { label: 'GitHub', url: profile.links.github },
    { label: 'LinkedIn', url: profile.links.linkedin },
  ];
  if (profile.links.email) {
    linkData.push({ label: 'Email', url: `mailto:${profile.links.email}` });
  }
  if (profile.ventures && profile.ventures.length > 0 && profile.ventures[0].url) {
    linkData.push({ label: 'Venture', url: profile.ventures[0].url });
  }

  linkData.forEach((link, i) => {
    if (i > 0) {
      const sep = el('span', 'separator');
      sep.textContent = '\u00b7';
      links.appendChild(sep);
    }
    const a = document.createElement('a');
    a.href = link.url;
    a.textContent = link.label;
    if (!link.url.startsWith('mailto:')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    links.appendChild(a);
  });

  header.appendChild(links);

  // Theme toggle — aligned with the name, right side
  const toggle = document.createElement('button');
  toggle.className = 'theme-toggle toggle-hidden';
  toggle.setAttribute('aria-label', 'Toggle dark mode');
  setToggleIcon(toggle, isDarkMode());
  toggle.addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setToggleIcon(toggle, next === 'dark');
    if (window.rebuildContentMask) window.rebuildContentMask();
  });
  header.appendChild(toggle);

  return header;
}

function renderAbout(siteContent) {
  const section = el('section', 'section reveal');

  section.appendChild(elText('h2', 'About', 'section-title'));

  const prose = el('div', 'section-prose');
  siteContent.about.forEach(function (text) {
    const p = document.createElement('p');
    p.textContent = text.trim();
    prose.appendChild(p);
  });

  section.appendChild(prose);
  return section;
}

function renderInterests(nicholas) {
  const section = el('section', 'section reveal');
  section.appendChild(elText('h2', 'Interests', 'section-title'));

  const list = el('ul', 'interests-list reveal-stagger');

  nicholas.interests.forEach((interest) => {
    const li = document.createElement('li');

    const name = el('div', 'interest-name');
    name.textContent = interest.name;
    const depth = el('span', 'interest-depth');
    depth.textContent = interest.depth;
    name.appendChild(depth);
    li.appendChild(name);

    const desc = el('div', 'interest-description');
    desc.textContent = interest.description.trim();
    li.appendChild(desc);

    list.appendChild(li);
  });

  section.appendChild(list);
  return section;
}

function renderProjects(nicholas) {
  const section = el('section', 'section reveal');
  section.appendChild(elText('h2', 'Selected Work', 'section-title'));

  const list = el('ul', 'projects-list reveal-stagger');

  nicholas.projects.featured.forEach((project) => {
    const li = document.createElement('li');

    const name = el('div', 'project-name');
    const a = document.createElement('a');
    a.href = project.url;
    a.textContent = project.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    name.appendChild(a);
    li.appendChild(name);

    const tagline = el('div', 'project-tagline');
    tagline.textContent = project.tagline;
    li.appendChild(tagline);

    list.appendChild(li);
  });

  section.appendChild(list);
  return section;
}

function renderFooter(profile) {
  const footer = el('footer', 'site-footer reveal');
  const p = document.createElement('p');
  p.innerHTML = `&copy; ${new Date().getFullYear()} ${profile.name}`;
  footer.appendChild(p);

  // Live dodecahedron rotation coordinates
  const coords = el('p', 'footer-coords');
  coords.textContent = '\u25CB x: 0.0\u00B0  y: 0.0\u00B0  z: 0.0\u00B0';
  footer.appendChild(coords);

  // Update coordinates from scene.js CSS custom properties
  // Read from .style directly (not getComputedStyle) to avoid forced recalc
  function updateCoords() {
    var s = document.documentElement.style;
    var rx = s.getPropertyValue('--dodeca-rx') || '0.0';
    var ry = s.getPropertyValue('--dodeca-ry') || '0.0';
    var rz = s.getPropertyValue('--dodeca-rz') || '0.0';
    coords.textContent = '\u25CB x: ' + rx.trim() + '\u00B0  y: ' + ry.trim() + '\u00B0  z: ' + rz.trim() + '\u00B0';
    requestAnimationFrame(updateCoords);
  }
  requestAnimationFrame(updateCoords);

  return footer;
}

/* --- Glass card wrapper --- */

function wrapGlass(content, className) {
  const card = el('div', className || 'glass-card');
  card.appendChild(content);
  return card;
}

/* --- Utilities --- */

function el(tag, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function elText(tag, text, className) {
  const element = el(tag, className);
  element.textContent = text;
  return element;
}

/* --- Typewriter effect --- */

function typewrite(el, text, speed) {
  speed = speed || 40;

  // Accessibility: screen readers get the full text immediately
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.classList.add('typing');

  // Respect reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    el.classList.remove('typing');
    return;
  }

  var i = 0;
  var interval = setInterval(function () {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(interval);
      setTimeout(function () { el.classList.remove('typing'); }, 1000);
    }
  }, speed);
}

/* --- Scroll-triggered reveals --- */

function initScrollReveals() {
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => observer.observe(el));
}

/* --- Mouse proximity glow + click gleam --- */

function initMouseGlow() {
  if (window.matchMedia('(hover: none)').matches) return;

  // Create viewport-wide glow overlay
  var glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.appendChild(glow);

  // Track cursor — viewport coordinates (fixed positioning)
  document.addEventListener('mousemove', function (e) {
    glow.style.setProperty('--mouse-x', e.clientX + 'px');
    glow.style.setProperty('--mouse-y', e.clientY + 'px');
  });

  // Click gleam — radial pulse from click point
  document.addEventListener('click', function (e) {
    var gleam = document.createElement('div');
    gleam.className = 'click-gleam';
    gleam.style.left = e.clientX + 'px';
    gleam.style.top = e.clientY + 'px';
    document.body.appendChild(gleam);
    gleam.addEventListener('animationend', function () {
      gleam.remove();
    });
  });
}

/* --- Subtle content parallax --- */

function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var titles = document.querySelectorAll('.section-title');
  var ticking = false;

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var vh = window.innerHeight;
      titles.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var offset = (rect.top / vh - 0.5) * 8;
        el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
      });
      ticking = false;
    });
  }, { passive: true });
}

/* --- Theme toggle icons (SVG) --- */

function setToggleIcon(btn, isDark) {
  if (isDark) {
    // Sun icon
    btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>';
  } else {
    // Crescent moon icon
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none" opacity="0.7"/><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
}

/* --- Load ripple — liquid glass wave from toggle --- */

function spawnLoadRipple(toggle) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var rect = toggle.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;

  var ripple = document.createElement('div');
  ripple.className = 'load-ripple';
  ripple.style.left = cx + 'px';
  ripple.style.top = cy + 'px';
  document.body.appendChild(ripple);

  ripple.addEventListener('animationend', function () {
    ripple.remove();
  });
}
