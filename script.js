/* ============================================================
   SkillStack LMS — script.js
   Sections: Auth → User State → Router → Explore → Assignments → Course UI
   ============================================================ */

/* ─── In-memory "database" of registered users ─────────────
   Format: { email: { name, password } }
   Pre-seeded with one demo account for testing.            */
const USERS_DB = {
  'demo@skillstack.in': { name: 'Demo User', password: 'demo123' }
};

/* ─── Active session (null = logged out) ────────────────────── */
let currentUser = null; // { name, email }

/* ─── Course Data (INR pricing) ─────────────────────────────── */
const COURSES = [
  { id: 1,  title: "UI/UX Design Fundamentals",      instructor: "Sarah Chen",    lessons: 24, rating: 4.9, price: "₹5,799",  category: "design",      color: "blue",    level: "Beginner" },
  { id: 2,  title: "Full-Stack JavaScript",           instructor: "Marco Rossi",   lessons: 40, rating: 4.8, price: "₹7,499",  category: "development", color: "indigo",  level: "Intermediate" },
  { id: 3,  title: "Data Analysis with Python",       instructor: "Priya Nair",    lessons: 32, rating: 4.7, price: "₹6,599",  category: "data",        color: "teal",    level: "Intermediate" },
  { id: 4,  title: "Product Management Essentials",   instructor: "Lisa Park",     lessons: 18, rating: 4.9, price: "₹4,099",  category: "business",    color: "rose",    level: "Beginner" },
  { id: 5,  title: "Intro to Machine Learning",       instructor: "Dr. Kim",       lessons: 30, rating: 4.8, price: "₹6,599",  category: "ai",          color: "amber",   level: "Intermediate" },
  { id: 6,  title: "Growth Marketing Playbook",       instructor: "Tom Rivera",    lessons: 22, rating: 4.7, price: "₹3,299",  category: "business",    color: "emerald", level: "Beginner" },
  { id: 7,  title: "Advanced CSS & Animations",       instructor: "Nina Zhou",     lessons: 20, rating: 4.6, price: "₹4,599",  category: "design",      color: "rose",    level: "Advanced" },
  { id: 8,  title: "React from Zero to Hero",         instructor: "James Okafor",  lessons: 36, rating: 4.9, price: "₹8,299",  category: "development", color: "blue",    level: "Intermediate" },
  { id: 9,  title: "SQL & Database Design",           instructor: "Anna Müller",   lessons: 28, rating: 4.5, price: "₹3,799",  category: "data",        color: "amber",   level: "Beginner" },
  { id: 10, title: "NLP with Transformers",           instructor: "Dr. Patel",     lessons: 26, rating: 4.8, price: "₹7,499",  category: "ai",          color: "indigo",  level: "Advanced" },
  { id: 11, title: "Figma for Professionals",         instructor: "Claire Dubois", lessons: 15, rating: 4.7, price: "₹3,299",  category: "design",      color: "teal",    level: "Beginner" },
  { id: 12, title: "Node.js Microservices",           instructor: "Ben Carter",    lessons: 32, rating: 4.6, price: "₹6,599",  category: "development", color: "emerald", level: "Advanced" },
];

/* ─── Assignment Data ────────────────────────────────────────── */
const ASSIGNMENTS = [
  { id: 1, title: "JS Array Methods Quiz",      course: "Full-Stack JavaScript",         due: "2025-03-19", status: "pending",   grade: null },
  { id: 2, title: "Wireframe Design Project",   course: "UI/UX Design Fundamentals",     due: "2025-03-21", status: "pending",   grade: null },
  { id: 3, title: "Pandas DataFrame Task",      course: "Data Analysis with Python",     due: "2025-03-24", status: "pending",   grade: null },
  { id: 4, title: "Express REST API Build",     course: "Full-Stack JavaScript",         due: "2025-03-10", status: "submitted", grade: null },
  { id: 5, title: "User Research Report",       course: "UI/UX Design Fundamentals",     due: "2025-03-05", status: "graded",    grade: "A" },
  { id: 6, title: "NumPy Exercises",            course: "Data Analysis with Python",     due: "2025-02-28", status: "graded",    grade: "B+" },
  { id: 7, title: "Git Branching Exercise",     course: "Full-Stack JavaScript",         due: "2025-02-20", status: "graded",    grade: "A−" },
  { id: 8, title: "Color Theory Mood Board",    course: "UI/UX Design Fundamentals",     due: "2025-02-15", status: "graded",    grade: "A+" },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ─── Auth: populate user info across the UI ─────────────────── */
function applyUserToUI(user) {
  const initials = getInitials(user.name);
  const firstName = user.name.split(' ')[0];

  document.getElementById('sidebar-avatar').textContent     = initials;
  document.getElementById('sidebar-user-name').textContent  = user.name;
  document.getElementById('topbar-avatar').textContent      = initials;
  document.getElementById('user-greeting').textContent      = `${getGreeting()}, ${firstName} 👋`;
  document.getElementById('profile-avatar').textContent     = initials;
  document.getElementById('profile-name').textContent       = user.name;
  document.getElementById('profile-email').textContent      = user.email;
}

/* ─── Show / Hide screens ────────────────────────────────────── */
function showApp(user) {
  currentUser = user;
  applyUserToUI(user);
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  navigateTo('dashboard');
}

function showAuth() {
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  // Reset forms
  document.getElementById('form-login').reset();
  document.getElementById('form-signup').reset();
  clearAllErrors();
  switchAuthTab('login');
}

/* ─── Auth Tabs ──────────────────────────────────────────────── */
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('form-login').classList.toggle('auth-form--hidden', !isLogin);
  document.getElementById('form-signup').classList.toggle('auth-form--hidden', isLogin);
  document.getElementById('tab-login').classList.toggle('auth-tab--active', isLogin);
  document.getElementById('tab-signup').classList.toggle('auth-tab--active', !isLogin);
  clearAllErrors();
}

document.getElementById('tab-login').addEventListener('click',  () => switchAuthTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => switchAuthTab('signup'));
document.getElementById('go-signup').addEventListener('click',  () => switchAuthTab('signup'));
document.getElementById('go-login').addEventListener('click',   () => switchAuthTab('login'));

/* ─── Password show/hide toggle ─────────────────────────────── */
document.querySelectorAll('.field__toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.textContent = isPass ? 'Hide' : 'Show';
  });
});

/* ─── Field validation helpers ──────────────────────────────── */
function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}
function markInput(id, hasError) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('field__input--error', hasError);
}
function clearAllErrors() {
  ['login-email-err','login-pass-err','login-form-err',
   'signup-name-err','signup-email-err','signup-pass-err']
    .forEach(id => setError(id, ''));
  ['login-email','login-password','signup-name','signup-email','signup-password']
    .forEach(id => markInput(id, false));
}

/* ─── Login ──────────────────────────────────────────────────── */
document.getElementById('form-login').addEventListener('submit', e => {
  e.preventDefault();
  clearAllErrors();

  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  let valid = true;

  if (!email) {
    setError('login-email-err', 'Email is required.');
    markInput('login-email', true);
    valid = false;
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    setError('login-email-err', 'Enter a valid email address.');
    markInput('login-email', true);
    valid = false;
  }
  if (!password) {
    setError('login-pass-err', 'Password is required.');
    markInput('login-password', true);
    valid = false;
  }
  if (!valid) return;

  const user = USERS_DB[email];
  if (!user || user.password !== password) {
    setError('login-form-err', 'Incorrect email or password.');
    markInput('login-email', true);
    markInput('login-password', true);
    return;
  }

  showApp({ name: user.name, email });
});

/* ─── Signup ─────────────────────────────────────────────────── */
document.getElementById('form-signup').addEventListener('submit', e => {
  e.preventDefault();
  clearAllErrors();

  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  let valid = true;

  if (!name || name.length < 2) {
    setError('signup-name-err', 'Please enter your full name (at least 2 characters).');
    markInput('signup-name', true);
    valid = false;
  }
  if (!email) {
    setError('signup-email-err', 'Email is required.');
    markInput('signup-email', true);
    valid = false;
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    setError('signup-email-err', 'Enter a valid email address.');
    markInput('signup-email', true);
    valid = false;
  } else if (USERS_DB[email]) {
    setError('signup-email-err', 'An account with this email already exists.');
    markInput('signup-email', true);
    valid = false;
  }
  if (password.length < 6) {
    setError('signup-pass-err', 'Password must be at least 6 characters.');
    markInput('signup-password', true);
    valid = false;
  }
  if (!valid) return;

  // Register and log in
  USERS_DB[email] = { name, password };
  showApp({ name, email });
});

/* ─── Sign Out ────────────────────────────────────────────────── */
document.getElementById('signout-btn').addEventListener('click', showAuth);

/* ─── Router ─────────────────────────────────────────────────── */
function navigateTo(pageId) {
  if (!pageId) return;

  document.querySelectorAll('.page').forEach(p => p.classList.add('page--hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.remove('page--hidden');

  document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
    link.classList.toggle('sidebar__link--active', link.dataset.page === pageId);
  });

  if (pageId === 'explore')     initExplorePage();
  if (pageId === 'assignments') initAssignmentsPage();

  closeSidebar();
  window.scrollTo({ top: 0 });
}

/* ─── Sidebar Toggle (mobile) ────────────────────────────────── */
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menu-btn');

function openSidebar() {
  sidebar.classList.add('sidebar--open');
  overlay.classList.add('overlay--visible');
}
function closeSidebar() {
  sidebar.classList.remove('sidebar--open');
  overlay.classList.remove('overlay--visible');
}

menuBtn.addEventListener('click', () =>
  sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar()
);
overlay.addEventListener('click', closeSidebar);

/* ─── Global click delegation (data-page links) ──────────────── */
document.addEventListener('click', e => {
  const target = e.target.closest('[data-page]');
  if (target && target.dataset.page) navigateTo(target.dataset.page);
});

/* ─── Explore Page ───────────────────────────────────────────── */
let exploreFilter = 'all';
let exploreSearch = '';
let exploreReady  = false;

function initExplorePage() {
  if (!exploreReady) {
    document.getElementById('filter-chips').addEventListener('click', e => {
      const chip = e.target.closest('.chip[data-filter]');
      if (!chip) return;
      exploreFilter = chip.dataset.filter;
      document.querySelectorAll('#filter-chips .chip').forEach(c =>
        c.classList.toggle('chip--active', c === chip)
      );
      renderExploreGrid();
    });

    document.getElementById('explore-search').addEventListener('input', e => {
      exploreSearch = e.target.value.toLowerCase();
      renderExploreGrid();
    });

    exploreReady = true;
  }
  renderExploreGrid();
}

function renderExploreGrid() {
  const grid  = document.getElementById('explore-grid');
  const empty = document.getElementById('explore-empty');

  const filtered = COURSES.filter(c => {
    const matchCat    = exploreFilter === 'all' || c.category === exploreFilter;
    const matchSearch = c.title.toLowerCase().includes(exploreSearch) ||
                        c.instructor.toLowerCase().includes(exploreSearch);
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(c => `
    <article class="explore-card" data-page="course">
      <div class="explore-card__thumb course-card__thumb--${c.color}">
        <span class="course-card__label">${categoryLabel(c.category)}</span>
      </div>
      <div class="explore-card__body">
        <p class="explore-card__category">${c.category === 'ai' ? 'AI & ML' : c.category}</p>
        <h3 class="explore-card__title">${c.title}</h3>
        <p class="explore-card__meta">${c.instructor} · ${c.lessons} lessons · ${c.level}</p>
        <div class="explore-card__footer">
          <span class="explore-card__price">${c.price}</span>
          <span class="explore-card__rating">★ ${c.rating}</span>
        </div>
      </div>
    </article>
  `).join('');
}

function categoryLabel(cat) {
  return { design: 'Design', development: 'Dev', data: 'Data', business: 'Biz', ai: 'AI' }[cat] ?? cat;
}

/* ─── Assignments Page ───────────────────────────────────────── */
let assignFilter = 'all';
let assignReady  = false;

function initAssignmentsPage() {
  if (!assignReady) {
    document.querySelectorAll('[data-assign-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        assignFilter = chip.dataset.assignFilter;
        document.querySelectorAll('[data-assign-filter]').forEach(c =>
          c.classList.toggle('chip--active', c === chip)
        );
        renderAssignments();
      });
    });
    assignReady = true;
  }
  renderAssignments();
}

function renderAssignments() {
  const tbody = document.getElementById('assignments-body');

  const filtered = assignFilter === 'all'
    ? ASSIGNMENTS
    : ASSIGNMENTS.filter(a => a.status === assignFilter);

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No assignments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const { label, cls } = statusBadge(a.status);
    const dueText  = formatDue(a.due);
    const isUrgent = isOverdue(a.due) && a.status === 'pending';
    return `
      <tr>
        <td>
          <div class="assign-title">${a.title}</div>
          <div class="assign-course">${a.course}</div>
        </td>
        <td>${a.course}</td>
        <td class="${isUrgent ? 'assign-due-urgent' : ''}">${dueText}</td>
        <td><span class="badge badge--${cls}">${label}</span></td>
        <td>${a.grade ?? '—'}</td>
        <td>
          ${a.status === 'pending'
            ? `<button class="btn btn--primary btn--sm">Submit</button>`
            : `<button class="btn btn--ghost btn--sm">View</button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

function statusBadge(status) {
  return {
    pending:   { label: 'Pending',   cls: 'pending' },
    submitted: { label: 'Submitted', cls: 'submitted' },
    graded:    { label: 'Graded',    cls: 'graded' },
  }[status] ?? { label: status, cls: 'neutral' };
}

function formatDue(dateStr) {
  const date  = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff < 0)    return `${Math.abs(diff)}d ago`;
  if (diff < 7)    return `${diff} days`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr) {
  return new Date(dateStr) < new Date();
}

/* ─── Course Page: Module Accordion ─────────────────────────── */
document.getElementById('module-list').addEventListener('click', e => {
  const header = e.target.closest('.module__header');
  if (!header) return;
  const list = document.getElementById(header.dataset.module);
  if (!list) return;
  const isOpen = list.classList.contains('lesson-list--open');
  list.classList.toggle('lesson-list--open', !isOpen);
  header.classList.toggle('module__header--open', !isOpen);
});

document.getElementById('module-list').addEventListener('click', e => {
  const item = e.target.closest('.lesson-item');
  if (!item || e.target.closest('.module__header')) return;
  document.querySelectorAll('.lesson-item--active').forEach(el => el.classList.remove('lesson-item--active'));
  item.classList.add('lesson-item--active');
});

/* ─── Video Player ───────────────────────────────────────────── */
document.getElementById('play-btn').addEventListener('click', function () {
  const playing = this.textContent.includes('Pause');
  this.textContent = playing ? '▶ Play' : '⏸ Pause';
});

/* ─── Global search → redirect to Explore ───────────────────── */
document.getElementById('global-search').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    navigateTo('explore');
    setTimeout(() => {
      const input = document.getElementById('explore-search');
      if (input) {
        input.value = e.target.value;
        exploreSearch = e.target.value.toLowerCase();
        renderExploreGrid();
      }
      e.target.value = '';
    }, 50);
  }
});

/* ─── Init: start on auth screen ────────────────────────────── */
showAuth();
