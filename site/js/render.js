/**
 * Site renderer — reads YAML data from identity/ and content/,
 * renders the page into #root.
 *
 * Dependencies: js-yaml (loaded via CDN in index.html)
 */

(async function () {
  const root = document.getElementById('root');
  root.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const [profile, interests, projects] = await Promise.all([
      fetchYAML('identity/profile.yaml'),
      fetchYAML('content/interests.yaml'),
      fetchYAML('content/projects.yaml'),
    ]);

    root.innerHTML = '';
    root.appendChild(renderHeader(profile));
    root.appendChild(renderAbout());
    root.appendChild(renderInterests(interests));
    root.appendChild(renderProjects(projects));
    root.appendChild(renderFooter(profile));
  } catch (err) {
    console.error('Failed to render site:', err);
    root.innerHTML = '<p>Failed to load. Please try refreshing.</p>';
  }
})();

/* --- Data fetching --- */

async function fetchYAML(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  const text = await response.text();
  return jsyaml.load(text);
}

/* --- Render functions --- */

function renderHeader(profile) {
  const header = el('header', 'site-header');

  header.appendChild(elText('h1', profile.name));

  // Tagline — built from positioning, not stored as a field
  const tagline = el('p', 'tagline');
  tagline.textContent = 'Software Engineer \u00b7 AI Agents \u00b7 Applied Cognition';
  header.appendChild(tagline);

  // Venture line — Zealot Analytics, subtle
  if (profile.ventures && profile.ventures.length > 0) {
    const venture = profile.ventures[0];
    const vtag = el('p', 'venture-tag');
    vtag.textContent = 'Founder, ';
    if (venture.url) {
      const a = document.createElement('a');
      a.href = venture.url;
      a.textContent = venture.name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      vtag.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.textContent = venture.name;
      vtag.appendChild(span);
    }
    const focus = document.createTextNode(` \u2014 ${venture.focus}`);
    vtag.appendChild(focus);
    header.appendChild(vtag);
  }

  // Links row
  const links = el('nav', 'links-row');
  const linkData = [
    { label: 'GitHub', url: profile.links.github },
    { label: 'LinkedIn', url: profile.links.linkedin },
  ];
  if (profile.links.email) {
    linkData.push({ label: 'Email', url: `mailto:${profile.links.email}` });
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
  return header;
}

function renderAbout() {
  const section = el('section', 'section');

  section.appendChild(elText('h2', 'About', 'section-title'));

  const prose = el('div', 'section-prose');
  const p1 = document.createElement('p');
  p1.textContent = 'I build intelligent systems and think about how they learn. ' +
    'My work sits at the intersection of software engineering, reinforcement learning, ' +
    'and multi-agent AI \u2014 grounded in nine years of building production systems ' +
    'and a graduate research foundation from Georgia Tech.';
  prose.appendChild(p1);

  const p2 = document.createElement('p');
  p2.textContent = 'Lately, I\u2019m drawn to the harder questions: how agents coordinate, ' +
    'how humans think about thinking, and what subtraction can teach us about cognition. ' +
    'The through-line is a belief that rigorous thinking and practical building aren\u2019t ' +
    'separate pursuits \u2014 they\u2019re the same one.';
  prose.appendChild(p2);

  section.appendChild(prose);
  return section;
}

function renderInterests(data) {
  const section = el('section', 'section');
  section.appendChild(elText('h2', 'Interests', 'section-title'));

  const list = el('ul', 'interests-list');

  data.interests.forEach((interest) => {
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

function renderProjects(data) {
  const section = el('section', 'section');
  section.appendChild(elText('h2', 'Selected Work', 'section-title'));

  const list = el('ul', 'projects-list');

  data.featured.forEach((project) => {
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
  const footer = el('footer', 'site-footer');
  const p = document.createElement('p');
  p.innerHTML = `&copy; ${new Date().getFullYear()} ${profile.name}`;
  footer.appendChild(p);
  return footer;
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
