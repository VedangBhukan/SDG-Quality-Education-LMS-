/* ============================================================
   SkillStack LMS v2 — script.js  (CORRECTED FULL VERSION)
   Fixes: role sent in signup, role-based UI, enrollments,
   lecture player, file submissions, teacher panel, grading
   ============================================================ */

const API_BASE = 'http://localhost/WPL_Project/api';

/* ─── State ──────────────────────────────────────────────────── */
let currentUser     = null;   // { id, name, email, role }
let COURSES         = [];
let ENROLLMENTS     = [];     // enrolled courses with progress
let ASSIGNMENTS     = [];
let currentCourse   = null;   // course being viewed in player
let currentLectures = [];     // lectures for currently open course

/* ─── API Helpers ────────────────────────────────────────────── */
async function apiFetch(endpoint, method = 'GET', body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}/${endpoint}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiUpload(endpoint, formData) {
  const res  = await fetch(`${API_BASE}/${endpoint}`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

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
function formatDue(dateStr) {
  const date  = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((date - today) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff < 0)    return `${Math.abs(diff)}d overdue`;
  if (diff < 7)    return `${diff} days`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
function isOverdue(dateStr) { return new Date(dateStr) < new Date(); }
function categoryLabel(cat) {
  return { design: 'Design', development: 'Dev', data: 'Data', business: 'Biz', ai: 'AI' }[cat] ?? cat;
}
function colorClass(c) { return c || 'indigo'; }
function statusBadge(status) {
  return {
    pending:   { label: 'Pending',   cls: 'pending' },
    submitted: { label: 'Submitted', cls: 'submitted' },
    graded:    { label: 'Graded',    cls: 'graded' },
  }[status] ?? { label: status, cls: 'neutral' };
}

/* ─── Auth UI Switches ───────────────────────────────────────── */
document.getElementById('tab-login').addEventListener('click',  () => switchAuthTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => switchAuthTab('signup'));
document.getElementById('go-signup').addEventListener('click',  () => switchAuthTab('signup'));
document.getElementById('go-login').addEventListener('click',   () => switchAuthTab('login'));

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('form-login').classList.toggle('auth-form--hidden', !isLogin);
  document.getElementById('form-signup').classList.toggle('auth-form--hidden', isLogin);
  document.getElementById('tab-login').classList.toggle('auth-tab--active', isLogin);
  document.getElementById('tab-signup').classList.toggle('auth-tab--active', !isLogin);
  clearAllErrors();
}

document.querySelectorAll('.field__toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isP   = input.type === 'password';
    input.type  = isP ? 'text' : 'password';
    btn.textContent = isP ? 'Hide' : 'Show';
  });
});

/* ─── Validation Helpers ─────────────────────────────────────── */
function setError(id, msg)     { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearError(id)        { const el = document.getElementById(id); if (el) el.textContent = ''; }
function markInput(id, hasErr) { const el = document.getElementById(id); if (el) el.classList.toggle('field__input--error', hasErr); }
function clearAllErrors() {
  ['login-email-err','login-pass-err','login-form-err','signup-name-err','signup-email-err','signup-pass-err']
    .forEach(id => setError(id, ''));
  ['login-email','login-password','signup-name','signup-email','signup-password']
    .forEach(id => markInput(id, false));
}

/* ─── Login ──────────────────────────────────────────────────── */
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault(); clearAllErrors();
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  let valid = true;
  if (!email) { setError('login-email-err', 'Email is required.'); markInput('login-email', true); valid = false; }
  if (!password) { setError('login-pass-err', 'Password is required.'); markInput('login-password', true); valid = false; }
  if (!valid) return;
  try {
    const data = await apiFetch('login.php', 'POST', { email, password });
    await showApp(data.user);
  } catch (err) {
    setError('login-form-err', err.message || 'Incorrect email or password.');
    markInput('login-email', true); markInput('login-password', true);
  }
});

/* ─── Signup ─────────────────────────────────────────────────── */
document.getElementById('form-signup').addEventListener('submit', async e => {
  e.preventDefault(); clearAllErrors();
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const role     = document.getElementById('signup-role').value; // FIX: read role dropdown
  let valid = true;
  if (name.length < 2) { setError('signup-name-err', 'At least 2 characters.'); markInput('signup-name', true); valid = false; }
  if (!/\S+@\S+\.\S+/.test(email)) { setError('signup-email-err', 'Valid email required.'); markInput('signup-email', true); valid = false; }
  if (password.length < 6) { setError('signup-pass-err', 'Min 6 characters.'); markInput('signup-password', true); valid = false; }
  if (!valid) return;
  try {
    const data = await apiFetch('signup.php', 'POST', { name, email, password, role }); // FIX: send role
    await showApp(data.user);
  } catch (err) {
    setError('signup-email-err', err.message || 'Could not create account.');
    markInput('signup-email', true);
  }
});

/* ─── Sign Out ───────────────────────────────────────────────── */
document.getElementById('signout-btn').addEventListener('click', showAuth);

/* ─── Show App ───────────────────────────────────────────────── */
async function showApp(user) {
  currentUser = user;
  applyUserToUI(user);
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // FIX: Role-based UI
  const isTeacher = user.role === 'teacher';
  document.querySelectorAll('.teacher-only').forEach(el => el.style.display = isTeacher ? '' : 'none');
  document.getElementById('sidebar-user-role').textContent = isTeacher ? 'Teacher' : 'Student';

  await loadCourses();
  if (!isTeacher) await loadEnrollments();

  navigateTo('dashboard');
}

function applyUserToUI(user) {
  const initials  = getInitials(user.name);
  const firstName = user.name.split(' ')[0];
  ['sidebar-avatar', 'topbar-avatar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = initials;
  });
  const greet = document.getElementById('user-greeting');
  if (greet) greet.textContent = `${getGreeting()}, ${firstName} 👋`;
  const profAvatar = document.getElementById('profile-avatar');  if (profAvatar)  profAvatar.textContent  = initials;
  const profName   = document.getElementById('profile-name');    if (profName)    profName.textContent    = user.name;
  const profEmail  = document.getElementById('profile-email');   if (profEmail)   profEmail.textContent   = user.email;
  const profRole   = document.getElementById('profile-role');    if (profRole)    profRole.textContent    = user.role === 'teacher' ? 'Teacher' : 'Student';
  const sName      = document.getElementById('sidebar-user-name'); if (sName)     sName.textContent       = user.name;
}

function showAuth() {
  currentUser = null; COURSES = []; ENROLLMENTS = []; ASSIGNMENTS = [];
  currentCourse = null; currentLectures = [];
  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  const fl = document.getElementById('form-login');   if (fl) fl.reset();
  const fs = document.getElementById('form-signup');  if (fs) fs.reset();
  clearAllErrors();
  switchAuthTab('login');
}

/* ─── Data Loaders ───────────────────────────────────────────── */
async function loadCourses() {
  try {
    const data = await apiFetch('courses.php');
    COURSES = data.courses;
  } catch (err) { console.error('loadCourses:', err); }
}

async function loadEnrollments() {
  if (!currentUser) return;
  try {
    const data = await apiFetch(`enrollments.php?user_id=${currentUser.id}`);
    ENROLLMENTS = data.enrollments;
  } catch (err) { console.error('loadEnrollments:', err); }
}

/* ─── Router ─────────────────────────────────────────────────── */
function navigateTo(pageId) {
  if (!pageId) return;
  document.querySelectorAll('.page').forEach(p => p.classList.add('page--hidden'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.remove('page--hidden');
  document.querySelectorAll('.sidebar__link[data-page]').forEach(link =>
    link.classList.toggle('sidebar__link--active', link.dataset.page === pageId)
  );
  if (pageId === 'dashboard')   initDashboard();
  if (pageId === 'my-courses')  initMyCourses();
  if (pageId === 'explore')     initExplorePage();
  if (pageId === 'assignments') initAssignmentsPage();
  if (pageId === 'teacher')     initTeacherPanel();
  if (pageId === 'profile')     initProfile();
  closeSidebar();
  window.scrollTo({ top: 0 });
}

/* ─── Sidebar Toggle (Mobile) ────────────────────────────────── */
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menu-btn');

function openSidebar()  { sidebar.classList.add('sidebar--open');    overlay.classList.add('overlay--visible'); }
function closeSidebar() { sidebar.classList.remove('sidebar--open'); overlay.classList.remove('overlay--visible'); }

if (menuBtn) menuBtn.addEventListener('click', () =>
  sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar()
);
if (overlay) overlay.addEventListener('click', closeSidebar);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-page]');
  if (t && t.dataset.page) navigateTo(t.dataset.page);
});

/* ─── Global Search ─────────────────────────────────────────── */
const globalSearch = document.getElementById('global-search');
if (globalSearch) {
  globalSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      navigateTo('explore');
      setTimeout(() => {
        const inp = document.getElementById('explore-search');
        if (inp) { inp.value = e.target.value; exploreSearch = e.target.value.toLowerCase(); renderExploreGrid(); }
        e.target.value = '';
      }, 50);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function initDashboard() {
  const s1 = document.getElementById('stat-enrolled');
  const s2 = document.getElementById('stat-completed');
  const s3 = document.getElementById('stat-hours');
  if (s1) s1.textContent = ENROLLMENTS.length;
  if (s2) s2.textContent = ENROLLMENTS.filter(e => e.progress_pct === 100).length;
  if (s3) s3.textContent = ENROLLMENTS.reduce((s, e) => s + e.completed_lectures, 0);

  const continueList = document.getElementById('continue-list');
  if (continueList) {
    const inProgress = ENROLLMENTS.filter(e => e.progress_pct > 0 && e.progress_pct < 100).slice(0, 3);
    if (!inProgress.length) {
      continueList.innerHTML = `<p style="color:var(--text-muted);font-size:var(--font-size-sm)">
        No courses in progress. <button class="link-btn" data-page="explore">Explore courses →</button></p>`;
    } else {
      continueList.innerHTML = inProgress.map(e => `
        <div class="enrolled-item" style="cursor:pointer" onclick="openCoursePlayer(${e.course_id})">
          <div class="enrolled-item__thumb enrolled-item__thumb--${colorClass(e.color)}"></div>
          <div class="enrolled-item__info">
            <h3 class="enrolled-item__title">${e.title}</h3>
            <p class="enrolled-item__meta">${e.instructor} · ${e.completed_lectures}/${e.total_lectures} lessons</p>
            <div class="progress-bar progress-bar--sm"><div class="progress-bar__fill" style="--pct:${e.progress_pct}%"></div></div>
          </div>
          <span class="badge badge--info">${e.progress_pct}%</span>
        </div>`).join('');
    }
  }

  const upcomingList = document.getElementById('upcoming-list');
  if (upcomingList && currentUser?.role !== 'teacher') {
    const upcoming = ASSIGNMENTS.filter(a => a.status === 'pending').slice(0, 5);
    upcomingList.innerHTML = !upcoming.length
      ? `<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No pending assignments.</p>`
      : upcoming.map(a => `
          <div class="assign-item">
            <div class="assign-item__dot assign-item__dot--${isOverdue(a.due_date) ? 'urgent' : 'primary'}"></div>
            <div class="assign-item__info">
              <h4 class="assign-item__title">${a.title}</h4>
              <p class="assign-item__meta">${a.course || ''}</p>
            </div>
            <span class="badge badge--${isOverdue(a.due_date) ? 'urgent' : 'warning'}">${formatDue(a.due_date)}</span>
          </div>`).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   MY COURSES
   ═══════════════════════════════════════════════════════════════ */
function initMyCourses() {
  const grid = document.getElementById('my-courses-grid');
  if (!grid) return;
  if (!ENROLLMENTS.length) {
    grid.innerHTML = `<div class="empty-state">
      <h3>No courses yet</h3><p>Explore our catalogue and enroll in your first course.</p>
      <button class="btn btn--primary" data-page="explore">Browse Courses</button></div>`;
    return;
  }
  grid.innerHTML = ENROLLMENTS.map(e => `
    <div class="enrolled-course-card" onclick="openCoursePlayer(${e.course_id})">
      <div class="enrolled-course-card__thumb course-card__thumb--${colorClass(e.color)}">
        <span class="badge badge--neutral">${e.progress_pct}%</span>
      </div>
      <div class="enrolled-course-card__body">
        <h3 class="enrolled-course-card__title">${e.title}</h3>
        <p class="enrolled-course-card__meta">${e.instructor} · ${e.total_lectures} lessons</p>
      </div>
      <div class="enrolled-course-card__footer">
        <div class="progress-bar" style="flex:1">
          <div class="progress-bar__fill" style="--pct:${e.progress_pct}%"></div>
        </div>
        <button class="btn btn--primary btn--sm" style="margin-left:12px">Continue</button>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════════
   EXPLORE
   ═══════════════════════════════════════════════════════════════ */
let exploreFilter = 'all';
let exploreSearch = '';
let exploreReady  = false;

async function initExplorePage() {
  if (!exploreReady) {
    const chips = document.getElementById('filter-chips');
    if (chips) {
      chips.addEventListener('click', e => {
        const chip = e.target.closest('.chip[data-filter]');
        if (!chip) return;
        exploreFilter = chip.dataset.filter;
        document.querySelectorAll('#filter-chips .chip').forEach(c =>
          c.classList.toggle('chip--active', c === chip));
        renderExploreGrid();
      });
    }
    const searchEl = document.getElementById('explore-search');
    if (searchEl) searchEl.addEventListener('input', e => { exploreSearch = e.target.value.toLowerCase(); renderExploreGrid(); });
    exploreReady = true;
  }
  if (COURSES.length === 0) await loadCourses();
  renderExploreGrid();
}

function renderExploreGrid() {
  const grid  = document.getElementById('explore-grid');
  const empty = document.getElementById('explore-empty');
  if (!grid) return;

  const filtered = COURSES.filter(c => {
    const matchCat    = exploreFilter === 'all' || c.category === exploreFilter;
    const matchSearch = c.title.toLowerCase().includes(exploreSearch) || c.instructor.toLowerCase().includes(exploreSearch);
    return matchCat && matchSearch;
  });

  if (!filtered.length) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';

  const enrolledIds = new Set(ENROLLMENTS.map(e => e.course_id));
  grid.innerHTML = filtered.map(c => `
    <article class="explore-card">
      <div class="explore-card__thumb course-card__thumb--${colorClass(c.color)}">
        <span class="course-card__label">${categoryLabel(c.category)}</span>
      </div>
      <div class="explore-card__body">
        <p class="explore-card__category">${c.category === 'ai' ? 'AI & ML' : c.category}</p>
        <h3 class="explore-card__title">${c.title}</h3>
        <p class="explore-card__meta">${c.instructor} · ${c.lessons} lessons · ${c.level}</p>
        <div class="explore-card__footer">
          <span class="explore-card__price">${c.price ?? ''}</span>
          <span class="explore-card__rating">★ ${c.rating}</span>
        </div>
      </div>
      <div style="padding:0 16px 16px">
        ${enrolledIds.has(c.id)
          ? `<button class="btn btn--outline btn--full btn--sm" onclick="openCoursePlayer(${c.id})">Continue Learning</button>`
          : `<button class="btn btn--primary btn--full btn--sm" onclick="enrollInCourse(${c.id})">Enroll Now</button>`}
      </div>
    </article>`).join('');
}

async function enrollInCourse(courseId) {
  if (!currentUser) return;
  try {
    await apiFetch('enrollments.php', 'POST', { user_id: currentUser.id, course_id: courseId });
    await loadEnrollments();
    renderExploreGrid();
    showToast('Enrolled successfully! 🎉');
  } catch (err) { showToast(err.message, true); }
}

/* ═══════════════════════════════════════════════════════════════
   COURSE PLAYER
   ═══════════════════════════════════════════════════════════════ */
async function openCoursePlayer(courseId) {
  currentCourse = COURSES.find(c => c.id === courseId) ||
                  ENROLLMENTS.find(e => e.course_id === courseId) || null;
  if (!currentCourse) return;
  try {
    const data = await apiFetch(`lectures.php?course_id=${courseId}&user_id=${currentUser.id}`);
    currentLectures = data.lectures;
  } catch (err) { currentLectures = []; }
  renderCoursePlayer();
  navigateTo('course');
}

function renderCoursePlayer() {
  const c = currentCourse; if (!c) return;
  const titleEl = document.getElementById('course-player-title');
  if (titleEl) titleEl.textContent = c.title || '';

  const modules = {};
  currentLectures.forEach(l => {
    if (!modules[l.module_name]) modules[l.module_name] = [];
    modules[l.module_name].push(l);
  });

  const moduleList = document.getElementById('module-list');
  if (moduleList) {
    moduleList.innerHTML = Object.entries(modules).map(([modName, lecs], mi) => `
      <div class="module">
        <div class="module__header ${mi === 0 ? 'module__header--open' : ''}" data-module="mod-${mi}">
          <span>${modName}</span>
          <span style="font-size:11px;color:var(--text-muted)">${lecs.filter(l=>l.completed).length}/${lecs.length}</span>
        </div>
        <ul class="lesson-list ${mi === 0 ? 'lesson-list--open' : ''}" id="mod-${mi}">
          ${lecs.map(l => `
            <li class="lesson-item ${l.completed ? 'lesson-item--done' : ''}" onclick="playLecture(${l.id})">
              <span class="lesson-item__icon">${l.completed ? '✓' : '▶'}</span>
              <span class="lesson-item__title">${l.title}</span>
              <span class="lesson-item__duration">${l.duration}</span>
            </li>`).join('')}
        </ul>
      </div>`).join('');

    moduleList.addEventListener('click', e => {
      const header = e.target.closest('.module__header');
      if (!header) return;
      const list = document.getElementById(header.dataset.module);
      if (list) { list.classList.toggle('lesson-list--open'); header.classList.toggle('module__header--open'); }
    });
  }

  if (currentLectures.length) playLecture(currentLectures[0].id);
  renderCourseAssignments();
}

function playLecture(lectureId) {
  const lecture = currentLectures.find(l => l.id === lectureId);
  if (!lecture) return;
  const frame = document.getElementById('video-player-frame');
  if (frame) {
    frame.innerHTML = lecture.video_url
      ? `<iframe width="100%" height="100%" src="${lecture.video_url}" title="${lecture.title}" frameborder="0"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowfullscreen style="min-height:340px"></iframe>`
      : `<div class="video-placeholder"><p>No video available for this lecture.</p></div>`;
  }
  const lessonName = document.getElementById('current-lesson-name');
  if (lessonName) lessonName.textContent = lecture.title;
  const markBtn = document.getElementById('mark-complete-btn');
  if (markBtn) {
    markBtn.textContent = lecture.completed ? 'Mark Incomplete' : 'Mark Complete';
    markBtn.onclick = () => toggleLectureComplete(lectureId, !lecture.completed);
  }
}

async function toggleLectureComplete(lectureId, completed) {
  try {
    await apiFetch('lectures.php', 'POST', { user_id: currentUser.id, lecture_id: lectureId, completed: completed ? 1 : 0 });
    const lec = currentLectures.find(l => l.id === lectureId);
    if (lec) lec.completed = completed ? 1 : 0;
    await loadEnrollments();
    renderCoursePlayer();
    showToast(completed ? 'Lesson marked complete! ✓' : 'Marked as incomplete.');
  } catch (err) { showToast(err.message, true); }
}

function renderCourseAssignments() {
  const list = document.getElementById('course-assign-list');
  if (!list || !currentCourse) return;
  const cid = currentCourse.id || currentCourse.course_id;
  const courseAssignments = ASSIGNMENTS.filter(a => a.course_id == cid);
  if (!courseAssignments.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No assignments for this course.</p>`;
    return;
  }
  list.innerHTML = courseAssignments.map(a => {
    const { label, cls } = statusBadge(a.status || 'pending');
    return `
      <div class="course-assign-card">
        <div class="course-assign-card__info">
          <h4 class="course-assign-card__title">${a.title}</h4>
          <p class="course-assign-card__desc">${a.description || ''}</p>
          <span class="badge badge--${isOverdue(a.due_date) && a.status === 'pending' ? 'urgent' : 'neutral'}">
            Due ${formatDue(a.due_date)}</span>
        </div>
        <div class="course-assign-card__actions">
          <span class="badge badge--${cls}">${label}</span>
          ${!a.submission_id
            ? `<button class="btn btn--primary btn--sm" onclick="openSubmitModal(${a.id}, '${a.title.replace(/'/g,"\\'")}')">Submit</button>`
            : `<button class="btn btn--ghost btn--sm" onclick="openViewSubmissionModal(${a.submission_id})">View</button>`}
        </div>
      </div>`;
  }).join('');
}

document.querySelectorAll('.course-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.course-tab').forEach(t => t.classList.remove('course-tab--active'));
    document.querySelectorAll('.course-tab-content').forEach(c => c.classList.add('course-tab-content--hidden'));
    tab.classList.add('course-tab--active');
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.remove('course-tab-content--hidden');
  });
});

/* ═══════════════════════════════════════════════════════════════
   ASSIGNMENTS PAGE
   ═══════════════════════════════════════════════════════════════ */
let assignFilter = 'all';
let assignReady  = false;

async function initAssignmentsPage() {
  if (!assignReady) {
    document.querySelectorAll('[data-assign-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        assignFilter = chip.dataset.assignFilter;
        document.querySelectorAll('[data-assign-filter]').forEach(c =>
          c.classList.toggle('chip--active', c === chip));
        renderAssignments();
      });
    });
    assignReady = true;
  }
  try {
    const endpoint = currentUser.role === 'teacher'
      ? `assignments.php?teacher_id=${currentUser.id}`
      : `assignments.php?user_id=${currentUser.id}`;
    const data = await apiFetch(endpoint);
    ASSIGNMENTS = data.assignments;
  } catch (err) { console.error('loadAssignments:', err); }
  renderAssignments();
}

function renderAssignments() {
  const tbody = document.getElementById('assignments-body');
  if (!tbody) return;
  const filtered = assignFilter === 'all' ? ASSIGNMENTS : ASSIGNMENTS.filter(a => a.status === assignFilter);
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No assignments found.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(a => {
    const { label, cls } = statusBadge(a.status || 'pending');
    const isUrgent = isOverdue(a.due_date) && (a.status === 'pending' || !a.status);
    return `
      <tr>
        <td><div class="assign-title">${a.title}</div></td>
        <td>${a.course || ''}</td>
        <td class="${isUrgent ? 'assign-due-urgent' : ''}">${formatDue(a.due_date)}</td>
        <td><span class="badge badge--${cls}">${label}</span></td>
        <td>${a.grade ?? '—'}</td>
        <td>
          ${!a.submission_id
            ? `<button class="btn btn--primary btn--sm" onclick="openSubmitModal(${a.id}, '${a.title.replace(/'/g,"\\'")}')">Submit</button>`
            : `<button class="btn btn--ghost btn--sm" onclick="openViewSubmissionModal(${a.submission_id})">View</button>`}
        </td>
      </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   SUBMIT ASSIGNMENT MODAL
   ═══════════════════════════════════════════════════════════════ */
let submittingAssignmentId = null;
let selectedFile           = null;

function openSubmitModal(assignmentId, title) {
  submittingAssignmentId = assignmentId;
  selectedFile = null;
  document.getElementById('submit-modal-title').textContent = `Submit: ${title}`;
  const desc = document.getElementById('submit-modal-desc');
  if (desc) desc.textContent = 'Upload your file (PDF, DOC, DOCX, ZIP, image — max 10 MB).';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('drop-zone').style.display = 'flex';
  document.getElementById('submit-modal-err').textContent = '';
  document.getElementById('submit-modal').style.display = 'flex';
}

document.getElementById('submit-modal-close').addEventListener('click',  () => document.getElementById('submit-modal').style.display = 'none');
document.getElementById('submit-cancel-btn').addEventListener('click',   () => document.getElementById('submit-modal').style.display = 'none');

const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const dropZone  = document.getElementById('drop-zone');

if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', e => handleFileSelect(e.target.files[0]));
if (dropZone) {
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drop-zone--over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone--over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drop-zone--over');
    handleFileSelect(e.dataTransfer.files[0]);
  });
}

function handleFileSelect(file) {
  if (!file) return;
  selectedFile = file;
  document.getElementById('upload-file-name').textContent = file.name;
  document.getElementById('upload-preview').style.display = 'flex';
  document.getElementById('drop-zone').style.display = 'none';
}

const removeFileBtn = document.getElementById('remove-file-btn');
if (removeFileBtn) {
  removeFileBtn.addEventListener('click', () => {
    selectedFile = null; fileInput.value = '';
    document.getElementById('upload-preview').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'flex';
  });
}

document.getElementById('submit-confirm-btn').addEventListener('click', async () => {
  if (!selectedFile) { document.getElementById('submit-modal-err').textContent = 'Please select a file.'; return; }
  const btn = document.getElementById('submit-confirm-btn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('student_id',    currentUser.id);
  fd.append('assignment_id', submittingAssignmentId);
  fd.append('file',          selectedFile);
  try {
    await apiUpload('submissions.php', fd);
    document.getElementById('submit-modal').style.display = 'none';
    showToast('Assignment submitted! 🎉');
    await initAssignmentsPage();
  } catch (err) {
    document.getElementById('submit-modal-err').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Assignment';
  }
});

/* ─── View Submission Modal (Student) ────────────────────────── */
async function openViewSubmissionModal(submissionId) {
  const body = document.getElementById('view-submission-body');
  if (!body) return;
  body.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
  document.getElementById('view-submission-modal').style.display = 'flex';
  const a = ASSIGNMENTS.find(x => x.submission_id == submissionId);
  if (a) {
    body.innerHTML = `
      <div class="submission-detail">
        <div class="submission-detail__row"><span>File</span><strong>${a.submitted_file || '—'}</strong></div>
        <div class="submission-detail__row"><span>Submitted</span><strong>${a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN') : '—'}</strong></div>
        <div class="submission-detail__row"><span>Status</span><span class="badge badge--${a.status}">${a.status}</span></div>
        <div class="submission-detail__row"><span>Grade</span><strong>${a.grade || '—'}</strong></div>
        ${a.feedback ? `<div class="submission-detail__feedback"><h4>Feedback</h4><p>${a.feedback}</p></div>` : ''}
      </div>`;
  } else {
    body.innerHTML = '<p style="color:var(--text-muted)">No submission data found.</p>';
  }
}

document.getElementById('view-submission-close').addEventListener('click',  () => document.getElementById('view-submission-modal').style.display = 'none');
document.getElementById('view-submission-cancel').addEventListener('click', () => document.getElementById('view-submission-modal').style.display = 'none');

/* ═══════════════════════════════════════════════════════════════
   TEACHER PANEL
   ═══════════════════════════════════════════════════════════════ */
let teacherAssignments   = [];
let selectedAssignmentId = null;

async function initTeacherPanel() { await loadTeacherAssignments(); }

async function loadTeacherAssignments() {
  const list = document.getElementById('teacher-assignments-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Loading…</p>';
  try {
    const data = await apiFetch(`assignments.php?teacher_id=${currentUser.id}`);
    teacherAssignments = data.assignments;
    if (!teacherAssignments.length) {
      list.innerHTML = `<div class="empty-state"><h3>No Assignments Yet</h3><p>Create your first assignment above.</p></div>`;
      return;
    }
    list.innerHTML = teacherAssignments.map(a => `
      <div class="teacher-assign-card ${selectedAssignmentId == a.id ? 'teacher-assign-card--active' : ''}"
           onclick="loadSubmissions(${a.id})">
        <div>
          <h4 class="teacher-assign-card__title">${a.title}</h4>
          <p class="teacher-assign-card__meta">${a.course} · Due ${formatDue(a.due_date)}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:var(--rose);font-size:var(--font-size-sm)">${err.message}</p>`;
  }
}

async function loadSubmissions(assignmentId) {
  selectedAssignmentId = assignmentId;
  const a = teacherAssignments.find(x => x.id === assignmentId);
  const heading = document.getElementById('submissions-heading');
  if (heading) heading.textContent = `Submissions — ${a?.title ?? ''}`;

  document.querySelectorAll('.teacher-assign-card').forEach((el, i) =>
    el.classList.toggle('teacher-assign-card--active', teacherAssignments[i]?.id === assignmentId)
  );

  const list = document.getElementById('teacher-submissions-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Loading…</p>';
  try {
    const data = await apiFetch(`submissions.php?assignment_id=${assignmentId}`);
    const subs = data.submissions;
    if (!subs.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No submissions yet.</p>';
      return;
    }
    list.innerHTML = subs.map(s => `
      <div class="submission-card">
        <div class="submission-card__avatar">${getInitials(s.student_name)}</div>
        <div class="submission-card__info">
          <h4 class="submission-card__name">${s.student_name}</h4>
          <p class="submission-card__meta">
            📎 <a href="${API_BASE}/submissions.php?download=1&id=${s.id}" target="_blank">${s.file_name}</a>
            · ${new Date(s.submitted_at).toLocaleDateString('en-IN')}
          </p>
        </div>
        <div class="submission-card__actions">
          ${s.grade ? `<span class="badge badge--graded">Grade: ${s.grade}</span>` : `<span class="badge badge--pending">Ungraded</span>`}
          <button class="btn btn--primary btn--sm"
            onclick="openGradeModal(${s.id}, '${s.student_name.replace(/'/g,"\\'")}', '${s.grade ?? ''}', '${(s.feedback ?? '').replace(/'/g,"\\'")}')">
            ${s.grade ? 'Edit Grade' : 'Grade'}
          </button>
        </div>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:var(--rose);font-size:var(--font-size-sm)">${err.message}</p>`;
  }
}

/* ─── Grade Modal ────────────────────────────────────────────── */
let gradingSubmissionId = null;

function openGradeModal(submissionId, studentName, existingGrade, existingFeedback) {
  gradingSubmissionId = submissionId;
  document.getElementById('grade-modal-student').textContent = `Student: ${studentName}`;
  document.getElementById('grade-input').value    = existingGrade    || '';
  document.getElementById('feedback-input').value = existingFeedback || '';
  document.getElementById('grade-modal-err').textContent = '';
  document.getElementById('grade-modal').style.display = 'flex';
}

document.getElementById('grade-modal-close').addEventListener('click',  () => document.getElementById('grade-modal').style.display = 'none');
document.getElementById('grade-cancel-btn').addEventListener('click',   () => document.getElementById('grade-modal').style.display = 'none');

document.getElementById('grade-confirm-btn').addEventListener('click', async () => {
  const grade    = document.getElementById('grade-input').value.trim();
  const feedback = document.getElementById('feedback-input').value.trim();
  if (!grade) { document.getElementById('grade-modal-err').textContent = 'Grade is required.'; return; }
  const btn = document.getElementById('grade-confirm-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiFetch('submissions.php', 'PUT', { id: gradingSubmissionId, grade, feedback, graded_by: currentUser.id });
    document.getElementById('grade-modal').style.display = 'none';
    showToast('Grade saved! ✓');
    await loadSubmissions(selectedAssignmentId);
  } catch (err) {
    document.getElementById('grade-modal-err').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Save Grade';
  }
});

/* ─── New Assignment Modal ───────────────────────────────────── */
const newAssignBtn = document.getElementById('new-assignment-btn');
if (newAssignBtn) {
  newAssignBtn.addEventListener('click', () => {
    const sel = document.getElementById('na-course');
    if (sel) sel.innerHTML = COURSES.map(c => `<option value="${c.id}" data-title="${c.title}">${c.title}</option>`).join('');
    document.getElementById('na-title').value = '';
    document.getElementById('na-due').value   = '';
    document.getElementById('na-desc').value  = '';
    document.getElementById('na-err').textContent = '';
    document.getElementById('new-assign-modal').style.display = 'flex';
  });
}

document.getElementById('new-assign-close').addEventListener('click', () => document.getElementById('new-assign-modal').style.display = 'none');
document.getElementById('na-cancel').addEventListener('click',        () => document.getElementById('new-assign-modal').style.display = 'none');

document.getElementById('na-confirm').addEventListener('click', async () => {
  const title     = document.getElementById('na-title').value.trim();
  const courseEl  = document.getElementById('na-course');
  const course_id = +(courseEl?.value || 0);
  const course    = courseEl?.selectedOptions[0]?.dataset.title ?? '';
  const due_date  = document.getElementById('na-due').value;
  const desc      = document.getElementById('na-desc').value.trim();
  if (!title || !due_date) { document.getElementById('na-err').textContent = 'Title and due date are required.'; return; }
  const btn = document.getElementById('na-confirm');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await apiFetch('assignments.php', 'POST', { title, course_id, course, description: desc, due_date, created_by: currentUser.id });
    document.getElementById('new-assign-modal').style.display = 'none';
    showToast('Assignment created! ✓');
    await loadTeacherAssignments();
  } catch (err) {
    document.getElementById('na-err').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create Assignment';
  }
});

/* ═══════════════════════════════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════════════════════════════ */
function initProfile() {
  const s1 = document.getElementById('prof-stat-enrolled');
  const s2 = document.getElementById('prof-stat-completed');
  const s3 = document.getElementById('prof-stat-lessons');
  if (s1) s1.textContent = ENROLLMENTS.length;
  if (s2) s2.textContent = ENROLLMENTS.filter(e => e.progress_pct === 100).length;
  if (s3) s3.textContent = ENROLLMENTS.reduce((s, e) => s + e.completed_lectures, 0);

  const list = document.getElementById('profile-enrolled-list');
  if (!list) return;
  list.innerHTML = !ENROLLMENTS.length
    ? '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No courses enrolled yet.</p>'
    : ENROLLMENTS.map(e => `
        <div class="enrolled-item">
          <div class="enrolled-item__thumb enrolled-item__thumb--${colorClass(e.color)}"></div>
          <div class="enrolled-item__info">
            <h3 class="enrolled-item__title">${e.title}</h3>
            <p class="enrolled-item__meta">${e.instructor} · ${e.total_lectures} lessons</p>
            <div class="progress-bar progress-bar--sm">
              <div class="progress-bar__fill" style="--pct:${e.progress_pct}%"></div>
            </div>
          </div>
          <span class="badge badge--info">${e.progress_pct}%</span>
        </div>`).join('');
}

/* ─── Toast Notification ─────────────────────────────────────── */
function showToast(msg, isError = false) {
  let toast = document.getElementById('ss-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ss-toast';
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-lg);
      border-radius:var(--radius);padding:12px 22px;font-size:var(--font-size-sm);
      font-weight:600;z-index:9999;transition:opacity .3s;pointer-events:none;`;
    document.body.appendChild(toast);
  }
  toast.textContent  = msg;
  toast.style.color  = isError ? '#f43f5e' : 'var(--text-primary)';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

/* ─── Modal backdrop close ───────────────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
});

/* ─── Init ───────────────────────────────────────────────────── */
showAuth();
