/* ============================================================
   SkillStack LMS Pro — script.js
   Roles: student | teacher | admin
   ============================================================ */

const API = 'http://localhost/skillstack_pro/api';

/* ── State ─────────────────────────────────────────────────── */
let U = null;          
let allCourses = [];
let enrolledCourses = [];
let allAssignments = [];
let currentCourse = null;
let currentLessons = [];
let currentLessonId = null;
let pendingCourseId = null;   
let pendingAssignId = null;   
let pendingSubId = null;      
let pendingSubMaxMarks = 100;
let assignFilter = 'all';
let exploreFilter = 'all';
let exploreSearch = '';

/* ── Helpers ────────────────────────────────────────────────── */
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}/${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // PHP returned HTML (error/warning) instead of JSON
    const phpErr = text.replace(/<[^>]+>/g, '').trim().slice(0, 200);
    throw new Error('Server error: ' + (phpErr || 'Invalid response from server'));
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiUpload(path, formData) {
  const res = await fetch(`${API}/${path}`, { method: 'POST', body: formData });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const phpErr = text.replace(/<[^>]+>/g, '').trim().slice(0, 200);
    throw new Error('Server error: ' + (phpErr || 'Invalid response from server'));
  }
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function ini(name) {
  return name.trim().split(/\s+/).map(w=>w[0].toUpperCase()).slice(0,2).join('');
}
function greet() {
  const h = new Date().getHours();
  return h<12?'Good morning':h<17?'Good afternoon':'Good evening';
}
function fmt(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
function daysDiff(dateStr) {
  const d=new Date(dateStr),t=new Date();t.setHours(0,0,0,0);
  return Math.round((d-t)/86400000);
}
function rupee(n) { return '₹'+Number(n).toLocaleString('en-IN'); }
function showToast(msg, duration=3000) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.style.display='block';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.style.display='none',duration);
}
function closeModal(id) { document.getElementById(id).style.display='none'; }
function openModal(id)  { document.getElementById(id).style.display='flex'; }

/* ── Auth UI ────────────────────────────────────────────────── */
document.getElementById('tab-login').onclick  = () => switchTab('login');
document.getElementById('tab-signup').onclick = () => switchTab('signup');
document.getElementById('go-signup').onclick  = () => switchTab('signup');
document.getElementById('go-login').onclick   = () => switchTab('login');

function switchTab(t) {
  const isL = t==='login';
  document.getElementById('form-login').classList.toggle('auth-form--hidden',!isL);
  document.getElementById('form-signup').classList.toggle('auth-form--hidden',isL);
  document.getElementById('tab-login').classList.toggle('auth-tab--active',isL);
  document.getElementById('tab-signup').classList.toggle('auth-tab--active',!isL);
  clearErrors();
}

document.querySelectorAll('.field__eye').forEach(btn=>{
  btn.onclick=()=>{
    const i=document.getElementById(btn.dataset.target);
    i.type=i.type==='password'?'text':'password';
    btn.innerHTML=i.type==='password'?'<svg viewBox="0 0 20 20" width="16" height="16" fill="none"><ellipse cx="10" cy="10" rx="7" ry="4.5" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2" fill="currentColor"/></svg>':'<svg viewBox="0 0 20 20" width="16" height="16" fill="none"><ellipse cx="10" cy="10" rx="7" ry="4.5" stroke="currentColor" stroke-width="1.4"/><line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" stroke-width="1.4"/></svg>';
  };
});

function setErr(id,msg){const e=document.getElementById(id);if(e)e.textContent=msg;}
function markErr(id,has){const e=document.getElementById(id);if(e)e.classList.toggle('field__input--err',has);}
function clearErrors(){
  ['login-email-err','login-pass-err','login-form-err','su-name-err','su-email-err','su-pass-err'].forEach(id=>setErr(id,''));
  ['login-email','login-password','su-name','su-email','su-pass'].forEach(id=>markErr(id,false));
}

function fillDemo(email, pass) {
  document.getElementById('login-email').value    = email;
  document.getElementById('login-password').value = pass;
  switchTab('login');
}

/* ── Login ──────────────────────────────────────────────────── */
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault(); clearErrors();
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pass =document.getElementById('login-password').value;
  if (!email){setErr('login-email-err','Email required.');markErr('login-email',true);return;}
  if (!pass) {setErr('login-pass-err','Password required.');markErr('login-password',true);return;}
  try {
    const d = await apiFetch('auth.php?action=login','POST',{email,password:pass});
    bootApp(d.user);
  } catch(err){setErr('login-form-err',err.message);markErr('login-email',true);markErr('login-password',true);}
});

/* ── Signup ─────────────────────────────────────────────────── */
document.getElementById('form-signup').addEventListener('submit', async e => {
  e.preventDefault(); clearErrors();
  const name =document.getElementById('su-name').value.trim();
  const email=document.getElementById('su-email').value.trim().toLowerCase();
  const pass =document.getElementById('su-pass').value;
  const phone=document.getElementById('su-phone').value.trim();
  const role =document.querySelector('input[name="role"]:checked')?.value||'student';
  let ok=true;
  if(name.length<2){setErr('su-name-err','Min 2 characters.');markErr('su-name',true);ok=false;}
  if(!email||!/\S+@\S+\.\S+/.test(email)){setErr('su-email-err','Valid email required.');markErr('su-email',true);ok=false;}
  if(pass.length<6){setErr('su-pass-err','Min 6 characters.');markErr('su-pass',true);ok=false;}
  if(!ok)return;
  try {
    const d = await apiFetch('auth.php?action=signup','POST',{name,email,password:pass,phone,role});
    bootApp(d.user);
  } catch(err){setErr('su-email-err',err.message);markErr('su-email',true);}
});

/* ── Sign out ────────────────────────────────────────────────── */
['btn-signout','btn-signout-t','btn-signout-a'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.onclick=()=>{U=null;allCourses=[];enrolledCourses=[];allAssignments=[];showAuthScreen();};
});

/* ── Boot app after login ────────────────────────────────────── */
function bootApp(user) {
  U = user;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  applyUserToUI();
  // Show correct nav
  document.getElementById('nav-student').style.display = U.role==='student' ? '' : 'none';
  document.getElementById('nav-teacher').style.display = U.role==='teacher' ? '' : 'none';
  document.getElementById('nav-admin').style.display   = U.role==='admin'   ? '' : 'none';
  // Navigate to home page
  if (U.role==='admin')   navigateTo('a-dashboard');
  else if (U.role==='teacher') navigateTo('t-dashboard');
  else navigateTo('dashboard');
}

function showAuthScreen() {
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='grid';
  document.getElementById('form-login').reset();
  document.getElementById('form-signup').reset();
  clearErrors();
  switchTab('login');
}

function applyUserToUI() {
  const i = ini(U.name);
  const firstName = U.name.split(' ')[0];
  document.getElementById('sb-avatar').textContent   = i;
  document.getElementById('sb-name').textContent     = U.name;
  document.getElementById('sb-role').textContent     = U.role.charAt(0).toUpperCase()+U.role.slice(1);
  document.getElementById('topbar-avatar').textContent = i;
  document.getElementById('topbar-role-badge').textContent = U.role.toUpperCase();
  document.getElementById('topbar-role-badge').className =
    `badge badge--${U.role==='admin'?'admin':U.role==='teacher'?'teacher':'student'}`;
  const pr = document.getElementById('pr-avatar');
  if (pr) pr.textContent = i;
  const pn = document.getElementById('pr-name'); if (pn) pn.textContent = U.name;
  const pe = document.getElementById('pr-email'); if (pe) pe.textContent = U.email;
  const pp = document.getElementById('pr-phone'); if (pp) pp.textContent = U.phone||'';
  const prl = document.getElementById('pr-role'); if (prl) prl.textContent = U.role.charAt(0).toUpperCase()+U.role.slice(1);
  const g1 = document.getElementById('greeting'); if (g1) g1.textContent = `${greet()}, ${firstName}`;
  const g2 = document.getElementById('t-greeting'); if (g2) g2.textContent = `${greet()}, ${firstName}`;
}

/* ── Router ─────────────────────────────────────────────────── */
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p=>p.classList.add('page--hidden'));
  const pg = document.getElementById(`page-${pageId}`);
  if (pg) pg.classList.remove('page--hidden');
  document.querySelectorAll('.sidebar__link[data-page]').forEach(l=>
    l.classList.toggle('sidebar__link--active', l.dataset.page===pageId)
  );
  if (pageId==='dashboard')     loadStudentDashboard();
  if (pageId==='my-courses')    loadMyCourses();
  if (pageId==='explore')       loadExplore();
  if (pageId==='assignments')   loadStudentAssignments();
  if (pageId==='my-tests')      loadMyTests();
  if (pageId==='payments')      loadPayments();
  if (pageId==='profile')       loadProfile();
  if (pageId==='t-dashboard')   loadTeacherDashboard();
  if (pageId==='t-assignments') loadTeacherAssignments();
  if (pageId==='t-tests')       loadTeacherTests();
  if (pageId==='t-grading')     loadGrading();
  if (pageId==='a-dashboard')   loadAdminDashboard();
  if (pageId==='a-courses')     loadAdminCourses();
  if (pageId==='a-users')       loadAdminUsers();
  if (pageId==='a-assignments') loadAdminAssignments();
  if (pageId==='a-payments')    loadAdminPayments();
  closeSidebar(); window.scrollTo({top:0});
}

/* Global data-page delegation */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-page]');
  if (t && t.dataset.page) navigateTo(t.dataset.page);
});

/* ── Sidebar ────────────────────────────────────────────────── */
const sidebar=document.getElementById('sidebar');
const overlay=document.getElementById('overlay');
document.getElementById('btn-menu').onclick=()=>sidebar.classList.contains('sidebar--open')?closeSidebar():openSidebar();
overlay.onclick=closeSidebar;
function openSidebar(){sidebar.classList.add('sidebar--open');overlay.classList.add('overlay--visible');}
function closeSidebar(){sidebar.classList.remove('sidebar--open');overlay.classList.remove('overlay--visible');}

/* ── Global search ──────────────────────────────────────────── */
document.getElementById('global-search').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.value.trim()){
    exploreSearch=e.target.value.toLowerCase(); e.target.value='';
    navigateTo('explore');
  }
});

/* ============================================================
   STUDENT PAGES
   ============================================================ */

async function loadEnrolled() {
  const d = await apiFetch(`courses.php?enrolled=1&user_id=${U.id}`);
  enrolledCourses = d.courses; return enrolledCourses;
}

/* ── Dashboard ──────────────────────────────────────────────── */
async function loadStudentDashboard() {
  await loadEnrolled();
  const body  = document.getElementById('dash-body');
  const empty = document.getElementById('empty-dash');
  if (!enrolledCourses.length) { body.style.display='none'; empty.style.display='flex'; return; }
  empty.style.display='none'; body.style.display='';

  // Stats
  const ad = await apiFetch(`assignments.php?user_id=${U.id}`);
  allAssignments = ad.assignments;
  const pending  = allAssignments.filter(a=>!a.sub_id).length;
  const graded   = allAssignments.filter(a=>a.sub_status==='graded').length;
  const totalDone= enrolledCourses.reduce((s,c)=>s+(c.done_lessons||0),0);

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${enrolledCourses.length}</span><span class="stat-card__lbl">Courses Enrolled</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${totalDone}</span><span class="stat-card__lbl">Lessons Completed</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${pending}</span><span class="stat-card__lbl">Assignments Pending</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${graded}</span><span class="stat-card__lbl">Grades Received</span></div>`;

  // Continue grid
  document.getElementById('continue-grid').innerHTML = enrolledCourses.slice(0,3).map(c=>courseCardHTML(c,true)).join('');

  // Deadlines
  const upcoming = allAssignments.filter(a=>!a.sub_id).slice(0,6);
  const dl = document.getElementById('deadline-list');
  dl.innerHTML = !upcoming.length
    ? '<div class="dl-item"><span style="color:var(--text-m);font-size:13px">No pending deadlines</span></div>'
    : upcoming.map(a=>{
        const d=daysDiff(a.due_date);
        const dotCls=d<0?'red':d<=3?'amber':'gray';
        const lbl=d<0?`${Math.abs(d)}d overdue`:d===0?'Today':`${d} days`;
        return `<div class="dl-item"><div class="dl-dot dl-dot--${dotCls}"></div>
          <div class="dl-info"><strong>${esc(a.title)}</strong><small>${esc(a.course_title||'')}</small></div>
          <span class="badge badge--${d<0?'danger':d<=3?'warning':'neutral'}">${lbl}</span></div>`;
      }).join('');
}

/* ── My Courses ─────────────────────────────────────────────── */
async function loadMyCourses() {
  await loadEnrolled();
  const grid=document.getElementById('my-courses-grid');
  const empty=document.getElementById('my-courses-empty');
  if (!enrolledCourses.length){grid.innerHTML='';empty.style.display='flex';return;}
  empty.style.display='none';
  grid.innerHTML=enrolledCourses.map(c=>courseCardHTML(c,true)).join('');
}

function courseCardHTML(c, enrolled=false) {
  const pct = c.total_lessons>0?Math.round((c.done_lessons/c.total_lessons)*100):0;
  const label = pct===0?'Start':pct===100?'Review':'Resume';
  const progressBar = enrolled ? `
    <div class="progress-bar"><div class="progress-bar__fill" style="--p:${pct}%"></div></div>
    <div class="progress-label"><span>${c.done_lessons||0}/${c.total_lessons} done</span><span>${pct}%</span></div>` : '';
  const freeTag = c.is_free ? '<span class="cc-free-badge">FREE</span>' :
                  `<span class="cc-price">₹10</span>`;
  return `<div class="course-card">
    <div class="cc-thumb cc-thumb--${c.color||'indigo'}"><span class="cc-label">${catLabel(c.category)}</span></div>
    <div class="cc-body">
      <h3 class="cc-title">${esc(c.title)}</h3>
      <p class="cc-meta">${esc(c.instructor||'')} · ${c.total_lessons} lessons · ${esc(c.level||'')}</p>
      ${!enrolled?freeTag:''}
      ${progressBar}
    </div>
    <div class="cc-footer">
      ${enrolled
        ? `<button class="btn btn--primary btn--sm" onclick="openCourse(${c.id})">${label}</button>`
        : c.is_enrolled
          ? `<button class="btn btn--outline btn--sm" onclick="openCourse(${c.id})">Continue →</button>`
          : `<button class="btn btn--primary btn--sm" onclick="startEnroll(${c.id})">${c.is_free?'Enrol Free':'Enrol Now'}</button>`
      }
    </div>
  </div>`;
}

/* ── Explore ────────────────────────────────────────────────── */
let exploreReady=false;
async function loadExplore() {
  if(!exploreReady){
    document.getElementById('filter-chips').addEventListener('click',e=>{
      const ch=e.target.closest('.chip[data-filter]'); if(!ch)return;
      exploreFilter=ch.dataset.filter;
      document.querySelectorAll('#filter-chips .chip').forEach(c=>c.classList.toggle('chip--active',c===ch));
      renderExplore();
    });
    document.getElementById('explore-search').addEventListener('input',e=>{
      exploreSearch=e.target.value.toLowerCase(); renderExplore();
    });
    exploreReady=true;
  }
  if(!allCourses.length){
    const d=await apiFetch(`courses.php?user_id=${U.id}`); allCourses=d.courses;
  }
  renderExplore();
}

function renderExplore(){
  const grid=document.getElementById('explore-grid');
  const empty=document.getElementById('explore-empty');
  const filtered=allCourses.filter(c=>{
    const mc=exploreFilter==='all'||c.category===exploreFilter;
    const mq=c.title.toLowerCase().includes(exploreSearch)||(c.instructor||'').toLowerCase().includes(exploreSearch);
    return mc&&mq;
  });
  if(!filtered.length){grid.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  grid.innerHTML=filtered.map(c=>{
    const enrolled=c.is_enrolled;
    return `<div class="course-card">
      <div class="cc-thumb cc-thumb--${c.color||'indigo'}"><span class="cc-label">${catLabel(c.category)}</span></div>
      <div class="cc-body">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--indigo);margin-bottom:4px">${c.category==='ai'?'AI & ML':c.category}</p>
        <h3 class="cc-title">${esc(c.title)}</h3>
        <p class="cc-meta">${esc(c.instructor||'')} · ${c.total_lessons} lessons · ${esc(c.level||'')}</p>
        ${c.is_free?'<span class="cc-free-badge">FREE</span>':`<span class="cc-price">₹10 <small style="text-decoration:line-through;opacity:.5;font-size:11px">${rupee(c.price)}</small></span>`}
        <div style="margin-top:6px">${c.rating} / 5</div>
      </div>
      <div class="cc-footer">
        ${enrolled
          ? `<span style="font-size:12px;font-weight:700;color:var(--success)">✓ Enrolled</span>
             <button class="btn btn--outline btn--sm" onclick="openCourse(${c.id})">Continue</button>`
          : `<button class="btn btn--primary btn--sm" onclick="startEnroll(${c.id})">
               ${c.is_free?'Enrol Free':'Enrol Now'}
             </button>`
        }
      </div>
    </div>`;
  }).join('');
}

/* ── Enroll / Payment ───────────────────────────────────────── */
function startEnroll(courseId) {
  const c = allCourses.find(x=>x.id===courseId);
  if (!c) return;
  if (c.is_free) { processEnroll(courseId,'free'); return; }
  pendingCourseId = courseId;
  document.getElementById('pay-course-name').textContent  = c.title;
  document.getElementById('pay-course-price').textContent = 'Demo price: ₹10';
  document.getElementById('ps-price').textContent = '₹10';
  document.getElementById('ps-total').textContent = '₹10';
  document.getElementById('pay-error').textContent = '';
  document.getElementById('btn-pay-now').disabled  = false;
  document.getElementById('btn-pay-now').textContent='Pay ₹10 & Enroll';
  openModal('pay-modal');
}

// Payment method tabs
document.querySelectorAll('.pm-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.pm-tab').forEach(t=>t.classList.remove('pm-tab--active'));
    tab.classList.add('pm-tab--active');
    document.querySelectorAll('.pm-panel').forEach(p=>p.style.display='none');
    document.getElementById(`pm-${tab.dataset.pm}`).style.display='flex';
  });
});
function setUpi(app){document.getElementById('upi-id').value=`yourname@${app}`;}

async function processPayment() {
  const method = document.querySelector('.pm-tab--active')?.dataset.pm||'upi';
  const btn=document.getElementById('btn-pay-now');
  const errEl=document.getElementById('pay-error');
  btn.disabled=true; btn.textContent='Processing…';
  errEl.textContent='';

  // Validate UPI if selected
  if (method==='upi') {
    const upiId = document.getElementById('upi-id').value.trim();
    // UPI is optional when using QR - allow blank (means QR was used)
  }

  try {
    // Simulate realistic payment delay (1.5s)
    await new Promise(r=>setTimeout(r,1500));
    const txn='UPI-'+Date.now()+'-'+Math.random().toString(36).substr(2,6).toUpperCase();
    await processEnroll(pendingCourseId, method, txn);
  } catch(err){
    btn.disabled=false; btn.textContent='Pay ₹10 & Enroll';
    errEl.textContent = err.message || 'Payment failed. Please try again.';
  }
}

async function processEnroll(courseId, method, txn='FREE') {
  const d = await apiFetch('enroll.php','POST',{user_id:U.id,course_id:courseId,method,txn_ref:txn});
  closeModal('pay-modal');
  const c=allCourses.find(x=>x.id===courseId);
  if(c) c.is_enrolled=true;
  enrolledCourses=[];
  showToast(`${d.message}`);
  setTimeout(()=>openCourse(courseId),800);
}

/* ── Course Player ──────────────────────────────────────────── */
async function openCourse(courseId) {
  if(!enrolledCourses.length) await loadEnrolled();
  currentCourse = enrolledCourses.find(c=>c.id===courseId)||allCourses.find(c=>c.id===courseId);
  if(!currentCourse) return;
  navigateTo('course');
  document.getElementById('crumb-title').textContent = currentCourse.title;
  document.getElementById('ci-title').textContent    = currentCourse.title;
  document.getElementById('ci-meta').textContent     = `${currentCourse.instructor||''} · ${currentCourse.level||''}`;
  document.getElementById('ci-desc').textContent     = currentCourse.description||'';

  const ld = await apiFetch(`lessons.php?course_id=${courseId}&user_id=${U.id}`);
  currentLessons = ld.lessons;
  renderModules();
  updateProgress();

  const ad = await apiFetch(`assignments.php?user_id=${U.id}&course_id=${courseId}`);
  renderCourseAssignments(ad.assignments);

  // Load course tests
  try {
    const td = await apiFetch(`tests.php?action=list&course_id=${courseId}&user_id=${U.id}`);
    renderCourseTests(td.tests);
  } catch(e) { renderCourseTests([]); }
}

function renderModules() {
  const groups={};
  currentLessons.forEach(l=>{ if(!groups[l.module_name]) groups[l.module_name]=[]; groups[l.module_name].push(l); });
  const total=currentLessons.length, done=currentLessons.filter(l=>l.completed).length;
  document.getElementById('lesson-count').textContent=`${done}/${total} done`;
  document.getElementById('lesson-panel').querySelector('.lesson-panel__header h2').textContent='Course Content';

  document.getElementById('module-list').innerHTML = Object.entries(groups).map(([mod,lessons],mi)=>{
    const isOpen=mi===0;
    return `<div class="module">
      <button class="mod-header ${isOpen?'mod-header--open':''}" data-mi="${mi}">
        <span>${esc(mod)}</span>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <div class="lesson-items ${isOpen?'lesson-items--open':''}" id="mi-${mi}">
        ${lessons.map(l=>{
          const active=currentLessonId===l.id;
          const chkCls=l.completed?'l-check--done':active?'l-check--active':'l-check--empty';
          const chkTxt=l.completed?'✓':active?'▶':'';
          const itemCls=l.completed?'lesson-item--done':active?'lesson-item--active':'';
          return `<div class="lesson-item ${itemCls}" onclick="playLesson(${l.id})">
            <span class="l-check ${chkCls}">${chkTxt}</span>
            <span>${esc(l.title)}</span>
            <span class="l-dur">${l.duration}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  document.getElementById('module-list').querySelectorAll('.mod-header').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const ul=document.getElementById(`mi-${btn.dataset.mi}`);
      const open=ul.classList.toggle('lesson-items--open');
      btn.classList.toggle('mod-header--open',open);
    });
  });
}

function playLesson(lessonId) {
  const l=currentLessons.find(x=>x.id===lessonId); if(!l) return;
  currentLessonId=lessonId;
  const ph=document.getElementById('video-placeholder');
  const fr=document.getElementById('video-frame');
  const bar=document.getElementById('video-bar');
  if(l.video_url){
    ph.style.display='none'; fr.style.display='block';
    let src=l.video_url.includes('watch?v=')?l.video_url.replace('watch?v=','embed/'):l.video_url;
    fr.src=src+'?autoplay=1';
    bar.style.display='flex';
    document.getElementById('playing-title').textContent=l.title;
    const mb=document.getElementById('btn-mark-done');
    if(l.completed){mb.textContent='✓ Completed';mb.className='btn btn--success btn--sm';}
    else{mb.textContent='✓ Mark Complete';mb.className='btn btn--primary btn--sm';}
  } else {
    ph.style.display='flex'; fr.style.display='none'; fr.src=''; bar.style.display='none';
    document.getElementById('placeholder-text').textContent=l.title+' — video coming soon';
  }
  renderModules();
}

async function markLessonComplete() {
  if(!currentLessonId)return;
  const l=currentLessons.find(x=>x.id===currentLessonId); if(!l||l.completed)return;
  await apiFetch('lessons.php','POST',{user_id:U.id,lesson_id:currentLessonId,completed:true});
  l.completed=true;
  const mb=document.getElementById('btn-mark-done');
  mb.textContent='✓ Completed'; mb.className='btn btn--success btn--sm';
  renderModules(); updateProgress();
  const ec=enrolledCourses.find(c=>c.id===currentCourse.id);
  if(ec) ec.done_lessons=(currentLessons.filter(x=>x.completed).length);
  showToast('Lesson marked complete');
}

function updateProgress(){
  const total=currentLessons.length,done=currentLessons.filter(l=>l.completed).length;
  const pct=total>0?Math.round(done/total*100):0;
  document.getElementById('ci-pct').textContent=`${pct}%`;
  document.getElementById('ci-bar').style.setProperty('--p',`${pct}%`);
}

function renderCourseAssignments(assignments){
  const sec=document.getElementById('course-assign-section');
  if(!assignments||!assignments.length){sec.style.display='none';return;}
  sec.style.display='';
  document.getElementById('course-assign-list').innerHTML=assignments.map(a=>{
    const submitted=!!a.sub_id; const graded=a.sub_status==='graded';
    const statusBadge=graded?`<span class="badge badge--graded">Graded: ${a.grade}</span>`:submitted?`<span class="badge badge--submitted">Submitted</span>`:`<span class="badge badge--pending">Pending</span>`;
    const btn=graded||submitted?'':`<button class="btn btn--primary btn--sm" onclick="openSubmitModal(${a.id},'${esc(a.title)}','${esc(a.course_title||'')}','${esc(a.description||'')}','${esc(a.template_file||'')}','${esc(a.template_name||'')}')">Submit</button>`;
    const tplLink=a.template_file?`<a class="template-link" href="${BASE_URL}/${esc(a.template_file)}" target="_blank">Download Template</a>`:'';
    return `<div class="ca-item">
      <div><div class="ca-item__title">${esc(a.title)}</div>${tplLink}<div class="ca-item__due">Due: ${fmt(a.due_date)} · Max: ${a.max_marks} marks</div></div>
      <div style="display:flex;align-items:center;gap:8px">${statusBadge}${btn}</div>
    </div>`;
  }).join('');
}

function renderCourseTests(tests) {
  const sec  = document.getElementById('course-tests-section');
  const list = document.getElementById('course-tests-list');
  if (!tests || !tests.length) { sec.style.display='none'; return; }
  sec.style.display='';
  list.innerHTML = tests.map(t => {
    const taken = t.attempts_taken > 0;
    const best  = t.best_score !== null ? parseFloat(t.best_score) : null;
    const badge = taken && best !== null
      ? (best >= t.pass_percent ? `<span class="badge badge--pass">Passed ${best.toFixed(0)}%</span>` : `<span class="badge badge--fail">Failed ${best.toFixed(0)}%</span>`)
      : `<span class="badge badge--not-taken">Not taken</span>`;
    const canRetake = !taken || t.attempts_taken < t.max_attempts;
    return `<div class="ca-item">
      <div>
        <div class="ca-item__title">${esc(t.title)}</div>
        <div class="ca-item__due">${t.total_questions} questions · ${t.duration_min} min · Pass: ${t.pass_percent}%</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${badge}
        ${taken ? `<button class="btn btn--outline btn--sm" onclick="viewMyResults(${t.id},'${esc(t.title)}')">Results</button>` : ''}
        ${canRetake ? `<button class="btn btn--primary btn--sm" onclick="startTest(${t.id},'${esc(t.title)}',${t.duration_min})">${taken?'Retake':'Start Test'}</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ── Student Assignments ────────────────────────────────────── */
let afReady=false;
async function loadStudentAssignments(){
  if(!afReady){
    document.querySelectorAll('[data-af]').forEach(ch=>{
      ch.addEventListener('click',()=>{
        assignFilter=ch.dataset.af;
        document.querySelectorAll('[data-af]').forEach(c=>c.classList.toggle('chip--active',c===ch));
        renderStudentAssignments();
      });
    }); afReady=true;
  }
  const d=await apiFetch(`assignments.php?user_id=${U.id}`);
  allAssignments=d.assignments; renderStudentAssignments();
}

function renderStudentAssignments(){
  const list=document.getElementById('assignment-list');
  let filtered=allAssignments;
  if(assignFilter==='pending')   filtered=allAssignments.filter(a=>!a.sub_id);
  if(assignFilter==='submitted') filtered=allAssignments.filter(a=>a.sub_id&&a.sub_status!=='graded');
  if(assignFilter==='graded')    filtered=allAssignments.filter(a=>a.sub_status==='graded');
  if(!filtered.length){list.innerHTML=`<div class="empty-state"><div class="es-icon"></div><p>No assignments in this category.</p></div>`;return;}
  list.innerHTML=filtered.map(a=>{
    const sub=!!a.sub_id,graded=a.sub_status==='graded';
    const diff=daysDiff(a.due_date);
    const dueCls=!sub&&diff<0?'assign-card__due--late':'';
    const dueLbl=diff<0?`${Math.abs(diff)} days overdue`:diff===0?'Due today':diff===1?'Due tomorrow':`Due ${fmt(a.due_date)}`;
    const statusBadge=graded?`<span class="badge badge--graded">Graded</span>`:sub?`<span class="badge badge--submitted">Submitted</span>`:`<span class="badge badge--pending">Pending</span>`;
    const gradeBlock=graded?`<div style="display:flex;align-items:center;gap:14px;margin-top:10px">
      <span class="assign-card__grade">${a.grade||'—'}</span>
      ${a.marks!=null?`<span class="badge badge--info">${a.marks} marks</span>`:''}
      ${a.feedback?`<div class="assign-card__feedback">${esc(a.feedback)}</div>`:''}
    </div>`:'';
    const subInfo=sub?`<div class="assign-card__submitted">${esc(a.file_name||'File submitted')} · ${fmt(a.submitted_at)}</div>`:'';
    const tplLink=a.template_file?`<div class="assign-card__template"><a class="template-link" href="${BASE_URL}/${esc(a.template_file)}" target="_blank">Download Template</a></div>`:'';
    const btn=graded||sub?'':`<button class="btn btn--primary btn--sm" onclick="openSubmitModal(${a.id},'${esc(a.title)}','${esc(a.course_title||'')}','${esc(a.description||'')}','${esc(a.template_file||'')}','${esc(a.template_name||'')}')">Upload &amp; Submit</button>`;
    return `<div class="assign-card">
      <div class="assign-card__top"><div><h3 class="assign-card__title">${esc(a.title)}</h3><p class="assign-card__course">${esc(a.course_title||'')}</p></div>${statusBadge}</div>
      ${a.description?`<p class="assign-card__desc">${esc(a.description)}</p>`:''}
      ${tplLink}
      <div class="assign-card__footer"><span class="assign-card__due ${dueCls}">${dueLbl}</span>${btn}</div>
      ${subInfo}${gradeBlock}
    </div>`;
  }).join('');
}

/* ── Submit Modal ───────────────────────────────────────────── */
const BASE_URL='http://localhost/WPL_Project';
function openSubmitModal(aid,title,course,desc,tplPath,tplName){
  pendingAssignId=aid;
  document.getElementById('sub-modal-title').textContent=title;
  document.getElementById('sub-modal-course').textContent=course;
  document.getElementById('sub-modal-desc').textContent=desc;
  document.getElementById('sub-error').textContent='';
  clearFile();
  document.getElementById('sub-notes').value='';
  const tplEl=document.getElementById('sub-template-link');
  const tplA =document.getElementById('sub-template-a');
  if(tplPath){tplEl.style.display='';tplA.href=`${BASE_URL}/${tplPath}`;tplA.textContent=`${tplName||'Download Template'}`;}
  else tplEl.style.display='none';
  openModal('submit-modal');
}
function handleFile(input){
  if(!input.files.length)return;
  const f=input.files[0];
  document.getElementById('file-preview').style.display='flex';
  document.getElementById('file-name').textContent=f.name;
  document.getElementById('drop-zone').style.display='none';
  document.getElementById('sub-error').textContent='';
}
function clearFile(){
  document.getElementById('sub-file').value='';
  document.getElementById('file-preview').style.display='none';
  document.getElementById('drop-zone').style.display='';
}
const dz=document.getElementById('drop-zone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drop-zone--over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('drop-zone--over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drop-zone--over');const fi=document.getElementById('sub-file');if(e.dataTransfer.files.length){const dt=e.dataTransfer;Object.defineProperty(fi,'files',{value:dt.files,writable:false});handleFile(fi);}});

async function submitAssignment(){
  const fi=document.getElementById('sub-file');
  if(!fi.files.length){document.getElementById('sub-error').textContent='Please select a file.';return;}
  const btn=document.getElementById('btn-submit-assign');
  btn.disabled=true;btn.textContent='Submitting…';
  const fd=new FormData();
  fd.append('user_id',U.id);fd.append('assignment_id',pendingAssignId);
  fd.append('file',fi.files[0]);fd.append('notes',document.getElementById('sub-notes').value);
  try{
    await apiUpload('submissions.php',fd);
    closeModal('submit-modal');showToast('Assignment submitted successfully!');
    await loadStudentAssignments();
  }catch(err){document.getElementById('sub-error').textContent=err.message;}
  btn.disabled=false;btn.textContent='Submit';
}

/* ── Payments ───────────────────────────────────────────────── */
async function loadPayments(){
  const d=await apiFetch(`enroll.php?user_id=${U.id}`);
  const tbody=document.getElementById('payments-tbody');
  if(!d.payments.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-m)">No payments yet.</td></tr>';return;}
  tbody.innerHTML=d.payments.map(p=>`<tr>
    <td>${esc(p.course_title)}</td>
    <td style="font-weight:600">${rupee(p.amount)}</td>
    <td><span class="badge badge--info">${p.method.toUpperCase()}</span></td>
    <td style="font-size:12px;color:var(--text-m)">${esc(p.txn_id)}</td>
    <td>${fmt(p.paid_at)}</td>
    <td><span class="badge badge--${p.status==='success'?'success':'danger'}">${p.status}</span></td>
  </tr>`).join('');
}

/* ── Profile ────────────────────────────────────────────────── */
async function loadProfile(){
  await loadEnrolled();
  const d=await apiFetch(`assignments.php?user_id=${U.id}`);
  const graded=d.assignments.filter(a=>a.sub_status==='graded').length;
  const totalDone=enrolledCourses.reduce((s,c)=>s+(c.done_lessons||0),0);
  document.getElementById('pr-stats').innerHTML=`
    <div><strong>${enrolledCourses.length}</strong><span>Courses</span></div>
    <div><strong>${totalDone}</strong><span>Lessons</span></div>
    <div><strong>${graded}</strong><span>Graded</span></div>`;
  const pc=document.getElementById('pr-courses');
  pc.innerHTML=!enrolledCourses.length?'<p style="color:var(--text-m);font-size:13px">No courses enrolled yet.</p>':
    enrolledCourses.map(c=>{
      const pct=c.total_lessons>0?Math.round(c.done_lessons/c.total_lessons*100):0;
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:flex;align-items:center;gap:14px;margin-bottom:10px;box-shadow:var(--shadow-sm)">
        <div style="width:44px;height:44px;border-radius:6px;flex-shrink:0" class="cc-thumb--${c.color||'indigo'}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</div>
          <div style="font-size:12px;color:var(--text-m)">${c.total_lessons} lessons · ${esc(c.level||'')}</div>
          <div class="progress-bar progress-bar--sm"><div class="progress-bar__fill" style="--p:${pct}%"></div></div>
        </div>
        <span class="badge badge--info">${pct}%</span>
      </div>`;
    }).join('');
}

/* ============================================================
   TEACHER PAGES
   ============================================================ */
async function loadTeacherDashboard(){
  const d=await apiFetch(`courses.php?user_id=${U.id}`);
  const myCourses=d.courses.filter(c=>c.teacher_id==U.id||true); // show all for now
  // Teacher stats
  const ad=await apiFetch(`assignments.php?teacher_id=${U.id}`);
  const ta=ad.assignments;
  const totalSubs=ta.reduce((s,a)=>s+(parseInt(a.sub_count)||0),0);
  const totalGraded=ta.reduce((s,a)=>s+(parseInt(a.graded_count)||0),0);
  document.getElementById('t-stats').innerHTML=`
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${d.courses.length}</span><span class="stat-card__lbl">Courses</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${ta.length}</span><span class="stat-card__lbl">Assignments</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${totalSubs}</span><span class="stat-card__lbl">Submissions</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${totalGraded}</span><span class="stat-card__lbl">Graded</span></div>`;
  document.getElementById('t-courses-grid').innerHTML=d.courses.map(c=>`<div class="course-card">
    <div class="cc-thumb cc-thumb--${c.color||'indigo'}"><span class="cc-label">${catLabel(c.category)}</span></div>
    <div class="cc-body"><h3 class="cc-title">${esc(c.title)}</h3><p class="cc-meta">${c.total_lessons} lessons · ${esc(c.level||'')}</p></div>
  </div>`).join('');
}

async function loadTeacherAssignments(){
  const d=await apiFetch(`assignments.php?teacher_id=${U.id}`);
  renderTeacherAssignments(d.assignments,'t-assignment-list');
}

function renderTeacherAssignments(assignments, containerId){
  const list=document.getElementById(containerId);
  if(!assignments.length){list.innerHTML=`<div class="empty-state"><div class="es-icon"></div><p>No assignments yet.</p></div>`;return;}
  list.innerHTML=assignments.map(a=>`
    <div class="t-assign-card" id="ta-${a.id}">
      <div class="t-assign-card__header" onclick="toggleAssignPanel(${a.id})">
        <div>
          <div class="t-assign-card__title">${esc(a.title)}</div>
          <div class="t-assign-card__meta">${esc(a.course_title||'')} · Due ${fmt(a.due_date)} · Max ${a.max_marks} marks</div>
          ${a.template_name?`<div style="margin-top:4px"><a class="template-link" href="${BASE_URL}/${esc(a.template_file)}" target="_blank" onclick="event.stopPropagation()">${esc(a.template_name)}</a></div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <span class="badge badge--info">${a.sub_count} submitted</span>
          <span class="badge badge--success">${a.graded_count} graded</span>
          <span id="ta-ch-${a.id}" style="color:var(--text-m);font-size:20px">›</span>
        </div>
      </div>
      <div class="t-assign-card__body" id="ta-body-${a.id}">
        <div id="ta-subs-${a.id}"><p class="no-subs">Loading…</p></div>
      </div>
    </div>`).join('');
}

async function toggleAssignPanel(id){
  const body=document.getElementById(`ta-body-${id}`);
  const ch=document.getElementById(`ta-ch-${id}`);
  const open=body.classList.toggle('t-assign-card__body--open');
  ch.textContent=open?'⌄':'›';
  if(open){
    const d=await apiFetch(`submissions.php?assignment_id=${id}`);
    const el=document.getElementById(`ta-subs-${id}`);
    if(!d.submissions.length){el.innerHTML='<p class="no-subs">No submissions yet.</p>';return;}
    el.innerHTML=d.submissions.map(s=>{
      const gradeBtn=s.status==='graded'
        ?`<span class="badge badge--graded">Grade: ${s.grade} (${s.marks??'—'} marks)</span>`
        :`<button class="btn btn--primary btn--sm" onclick="openGradeModal(${s.id},'${esc(s.student_name)}',${s.assignment_id})">Grade</button>`;
      const fileLink=s.file_path?`<a class="template-link" href="${BASE_URL}/${esc(s.file_path)}" target="_blank">${esc(s.file_name||'View file')}</a>`:'<span style="color:var(--text-m);font-size:12px">No file</span>';
      return `<div class="sub-row">
        <div class="sub-row__student"><div class="sub-row__name">${esc(s.student_name)}</div><div class="sub-row__email">${esc(s.student_email)}</div></div>
        ${fileLink}
        <span style="font-size:12px;color:var(--text-m)">${fmt(s.submitted_at)}</span>
        ${s.feedback?`<span style="font-size:12px;color:var(--text-s);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.feedback)}">${esc(s.feedback)}</span>`:''}
        ${gradeBtn}
      </div>`;
    }).join('');
  }
}

async function loadGrading(){
  const d=await apiFetch(`assignments.php?teacher_id=${U.id}`);
  renderTeacherAssignments(d.assignments,'grading-list');
}

/* ── Grade Modal ────────────────────────────────────────────── */
function openGradeModal(subId, studentName, assignId){
  pendingSubId=subId;
  document.getElementById('grade-student').textContent=`Student: ${studentName}`;
  document.getElementById('grade-marks').value='';
  document.getElementById('grade-select').value='';
  document.getElementById('grade-fb').value='';
  document.getElementById('grade-error').textContent='';
  // Get max marks if possible
  openModal('grade-modal');
}
async function saveGrade(){
  const marks=document.getElementById('grade-marks').value;
  const grade=document.getElementById('grade-select').value;
  const fb   =document.getElementById('grade-fb').value;
  if(!grade){document.getElementById('grade-error').textContent='Please select a grade.';return;}
  try{
    await apiFetch('submissions.php','PUT',{submission_id:pendingSubId,marks:marks||null,grade,feedback:fb,graded_by:U.id});
    closeModal('grade-modal');showToast(`Graded successfully — ${grade}`);
    // Refresh current grading page
    if(!document.getElementById('page-t-grading').classList.contains('page--hidden')) loadGrading();
    if(!document.getElementById('page-t-assignments').classList.contains('page--hidden')) loadTeacherAssignments();
  }catch(err){document.getElementById('grade-error').textContent=err.message;}
}

/* ── Create Assignment Modal ─────────────────────────────────── */
async function openCreateAssignModal(){
  // Populate course dropdown
  const dd=document.getElementById('ca-course');
  const d=await apiFetch(`courses.php?user_id=0`);
  dd.innerHTML=d.courses.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('');
  document.getElementById('ca-error').textContent='';
  openModal('create-assign-modal');
}

async function createAssignment(){
  const cid  =document.getElementById('ca-course').value;
  const title=document.getElementById('ca-title').value.trim();
  const desc =document.getElementById('ca-desc').value.trim();
  const due  =document.getElementById('ca-due').value;
  const marks=document.getElementById('ca-marks').value||100;
  const tpl  =document.getElementById('ca-template').files[0];
  if(!title||!due){document.getElementById('ca-error').textContent='Title and due date are required.';return;}
  const fd=new FormData();
  fd.append('course_id',cid); fd.append('teacher_id',U.id);
  fd.append('title',title); fd.append('description',desc);
  fd.append('due_date',due); fd.append('max_marks',marks);
  if(tpl) fd.append('template',tpl);
  try{
    await apiUpload('assignments.php',fd);
    closeModal('create-assign-modal');showToast('Assignment created!');
    if(U.role==='teacher') loadTeacherAssignments();
    if(U.role==='admin')   loadAdminAssignments();
  }catch(err){document.getElementById('ca-error').textContent=err.message;}
}

/* ============================================================
   ADMIN PAGES
   ============================================================ */
async function loadAdminDashboard(){
  const d=await apiFetch('admin.php?action=stats');
  const s=d.stats;
  document.getElementById('a-stats').innerHTML=`
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${s.total_users}</span><span class="stat-card__lbl">Students</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${s.total_teachers}</span><span class="stat-card__lbl">Teachers</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${s.total_courses}</span><span class="stat-card__lbl">Courses</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${s.total_enrolls}</span><span class="stat-card__lbl">Enrollments</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${rupee(s.total_revenue)}</span><span class="stat-card__lbl">Revenue</span></div>
    <div class="stat-card"><span class="stat-card__icon"></span><span class="stat-card__val">${s.pending_grades}</span><span class="stat-card__lbl">Pending Grades</span></div>`;
  const ad=await apiFetch('admin.php?action=activity');
  document.getElementById('activity-feed').innerHTML=ad.activity.map(a=>`
    <div class="activity-item"><div class="activity-dot"></div>
      <div style="flex:1"><strong>${esc(a.name)}</strong> ${a.type==='enrollment'?'enrolled in':'submitted for'} <span style="color:var(--indigo)">${esc(a.detail)}</span></div>
      <span style="font-size:11px;color:var(--text-m)">${fmt(a.at)}</span>
    </div>`).join('');
}

async function loadAdminCourses(){
  const d=await apiFetch('courses.php?user_id=0');
  document.getElementById('a-courses-tbody').innerHTML=d.courses.map(c=>`<tr>
    <td><strong>${esc(c.title)}</strong></td>
    <td>${esc(c.instructor||'—')}</td>
    <td><span class="badge badge--info">${c.category}</span></td>
    <td>${c.is_free?'<span class="badge badge--success">FREE</span>':rupee(c.price)}</td>
    <td>${c.total_lessons}</td>
    <td><span class="badge badge--${c.is_active?'success':'neutral'}">${c.is_active?'Active':'Inactive'}</span></td>
    <td><button class="btn btn--sm btn--ghost" onclick="toggleCourse(${c.id})">Toggle</button></td>
  </tr>`).join('');
}

async function toggleCourse(id){
  await apiFetch('admin.php?action=toggle_course','PUT',{id});
  showToast('Course status updated.');loadAdminCourses();
}

let adminUsersAll=[];
let userFilter='all';
async function loadAdminUsers(){
  const d=await apiFetch('admin.php?action=users');
  adminUsersAll=d.users;
  if(!document.getElementById('a-users-tbody').dataset.ready){
    document.querySelectorAll('[data-uf]').forEach(ch=>{
      ch.addEventListener('click',()=>{
        userFilter=ch.dataset.uf;
        document.querySelectorAll('[data-uf]').forEach(c=>c.classList.toggle('chip--active',c===ch));
        renderAdminUsers();
      });
    });
    document.getElementById('a-users-tbody').dataset.ready='1';
  }
  renderAdminUsers();
}
function renderAdminUsers(){
  const filtered=userFilter==='all'?adminUsersAll:adminUsersAll.filter(u=>u.role===userFilter);
  document.getElementById('a-users-tbody').innerHTML=filtered.map(u=>`<tr>
    <td><strong>${esc(u.name)}</strong></td>
    <td style="font-size:12px">${esc(u.email)}</td>
    <td><span class="badge badge--${u.role}">${u.role}</span></td>
    <td>${u.enrollments||0}</td>
    <td style="font-size:12px">${fmt(u.created_at)}</td>
    <td>${u.role!=='admin'?`<button class="btn btn--sm btn--danger" onclick="deleteUser(${u.id},'${esc(u.name)}')">Delete</button>`:''}</td>
  </tr>`).join('');
}
async function deleteUser(id,name){
  if(!confirm(`Delete user "${name}"? This will remove all their data.`))return;
  await apiFetch('admin.php?action=delete_user','DELETE',{id});
  showToast('User deleted.'); loadAdminUsers();
}

async function loadAdminAssignments(){
  const d=await apiFetch('assignments.php?admin=1');
  renderTeacherAssignments(d.assignments,'a-assignment-list');
}

async function loadAdminPayments(){
  const d=await apiFetch('admin.php?action=payments');
  document.getElementById('a-payments-tbody').innerHTML=d.payments.map(p=>`<tr>
    <td>${esc(p.student_name)}</td>
    <td style="font-size:12px">${esc(p.course_title)}</td>
    <td style="font-weight:600">${rupee(p.amount)}</td>
    <td><span class="badge badge--info">${p.method.toUpperCase()}</span></td>
    <td style="font-size:11px;color:var(--text-m)">${esc(p.txn_id)}</td>
    <td style="font-size:12px">${fmt(p.paid_at)}</td>
    <td><span class="badge badge--${p.status==='success'?'success':'danger'}">${p.status}</span></td>
  </tr>`).join('');
}

/* ── Create Course (Admin) ───────────────────────────────────── */
async function openCreateCourseModal(){
  const d=await apiFetch('admin.php?action=users&role=teacher');
  document.getElementById('cc-teacher').innerHTML=`<option value="">No teacher</option>`+d.users.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  document.getElementById('cc-error').textContent='';
  openModal('create-course-modal');
}
async function createCourse(){
  const title  =document.getElementById('cc-title').value.trim();
  const desc   =document.getElementById('cc-desc').value.trim();
  const cat    =document.getElementById('cc-cat').value;
  const level  =document.getElementById('cc-level').value;
  const color  =document.getElementById('cc-color').value;
  const price  =document.getElementById('cc-price').value||0;
  const teacher=document.getElementById('cc-teacher').value;
  if(!title){document.getElementById('cc-error').textContent='Title required.';return;}
  try{
    await apiFetch('admin.php?action=create_course','POST',{title,description:desc,category:cat,level,color,price,teacher_id:teacher||null});
    closeModal('create-course-modal');showToast('Course created!');
    allCourses=[];loadAdminCourses();
  }catch(err){document.getElementById('cc-error').textContent=err.message;}
}

/* ── Utils ──────────────────────────────────────────────────── */
function catLabel(cat){return{design:'Design',development:'Dev',data:'Data',business:'Biz',ai:'AI'}[cat]??cat;}

/* ── Init ───────────────────────────────────────────────────── */
showAuthScreen();

/* ═══════════════════════════════════════════════════════════════
   TESTS MODULE
═══════════════════════════════════════════════════════════════ */

let currentTestId    = null;
let currentAttemptId = null;
let testTimerInterval= null;
let testTimeLeft     = 0;
let testAnswers      = {};   // {question_id: chosen_ans}
let currentViewTestId    = null;
let currentViewTestTitle = '';

/* ── Student: Load & Display Tests ─────────────────────────── */
async function loadMyTests() {
  if (!enrolledCourses.length) await loadEnrolled();
  const list  = document.getElementById('my-tests-list');
  const empty = document.getElementById('my-tests-empty');
  list.innerHTML = '<p style="color:var(--text-m);font-size:14px">Loading tests…</p>';

  if (!enrolledCourses.length) {
    list.innerHTML=''; empty.style.display='block'; return;
  }
  empty.style.display='none';

  // Load tests for all enrolled courses
  const allTests = [];
  for (const c of enrolledCourses) {
    try {
      const d = await apiFetch(`tests.php?action=list&course_id=${c.id}&user_id=${U.id}`);
      d.tests.forEach(t => { t._course_title = c.title; t._course_color = c.color; });
      allTests.push(...d.tests);
    } catch(e) {}
  }

  if (!allTests.length) { list.innerHTML=''; empty.style.display='block'; return; }

  list.innerHTML = allTests.map(t => {
    const taken    = t.attempts_taken > 0;
    const best     = t.best_score !== null ? t.best_score : null;
    const passBadge= taken && best !== null
      ? (best >= t.pass_percent
          ? `<span class="badge badge--pass">Passed</span>`
          : `<span class="badge badge--fail">Failed</span>`)
      : `<span class="badge badge--not-taken">Not attempted</span>`;

    const scoreBox = taken && best !== null
      ? `<div class="test-card__score">${best.toFixed(0)}%<small>Best</small></div>` : '';

    const canAttempt = !taken || t.attempts_taken < t.max_attempts;
    const btnLabel   = taken ? 'Retake' : 'Start Test';

    return `<div class="test-card">
      <div class="test-card__info">
        <div class="test-card__title">${esc(t.title)}</div>
        <div class="test-card__meta">
          <span>${esc(t._course_title)}</span>
          <span>${t.total_questions} questions</span>
          <span>${t.duration_min} min</span>
          <span>Pass: ${t.pass_percent}%</span>
          <span>Attempts: ${t.attempts_taken}/${t.max_attempts}</span>
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">${passBadge}</div>
      </div>
      ${scoreBox}
      <div class="test-card__actions">
        ${taken ? `<button class="btn btn--outline btn--sm" onclick="viewMyResults(${t.id},'${esc(t.title)}')">View Results</button>` : ''}
        ${canAttempt ? `<button class="btn btn--primary btn--sm" onclick="startTest(${t.id},'${esc(t.title)}',${t.duration_min})">${btnLabel}</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ── Start Test ─────────────────────────────────────────────── */
async function startTest(testId, title, durationMin) {
  try {
    // Create attempt
    const a = await apiFetch('tests.php?action=start_attempt','POST',{test_id:testId, user_id:U.id});
    currentTestId    = testId;
    currentAttemptId = a.attempt_id;
    testAnswers      = {};

    // Load questions
    const q = await apiFetch(`tests.php?action=questions&test_id=${testId}&role=student`);
    renderTestQuestions(q.questions);

    document.getElementById('test-modal-title').textContent = title;
    document.getElementById('test-modal-meta').textContent  = `${q.questions.length} questions · ${durationMin} minutes`;
    openModal('test-modal');
    startTestTimer(durationMin * 60);
    updateAnsweredCount(q.questions.length);
  } catch(err) {
    showToast(err.message || 'Could not start test.'); 
  }
}

function renderTestQuestions(questions) {
  document.getElementById('btn-submit-test').dataset.total = questions.length;
  document.getElementById('test-questions-body').innerHTML = questions.map((q,i) => {
    const imgHtml = q.image_path
      ? `<div class="question-block__image"><img src="${BASE_URL}/${esc(q.image_path)}" alt="Question image"/></div>` : '';
    return `<div class="question-block" id="qblock-${q.id}">
      <div class="question-block__num">Question ${i+1} · ${q.marks} mark${q.marks>1?'s':''}</div>
      ${imgHtml}
      <div class="question-block__text">${esc(q.question_text)}</div>
      <div class="question-block__options">
        ${['a','b','c','d'].map(opt => `
          <label class="mcq-option" id="opt-${q.id}-${opt}" onclick="selectOption(${q.id},'${opt}',${questions.length})">
            <input type="radio" name="q${q.id}" value="${opt}"/>
            <span class="opt-letter">${opt.toUpperCase()}</span>
            <span>${esc(q['option_'+opt])}</span>
          </label>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function selectOption(qid, opt, total) {
  // Deselect all options for this question
  ['a','b','c','d'].forEach(o => {
    const el = document.getElementById(`opt-${qid}-${o}`);
    if (el) el.classList.remove('selected');
  });
  const selected = document.getElementById(`opt-${qid}-${opt}`);
  if (selected) selected.classList.add('selected');
  testAnswers[qid] = opt;
  updateAnsweredCount(total);
}

function updateAnsweredCount(total) {
  const answered = Object.keys(testAnswers).length;
  document.getElementById('test-answered-count').textContent = `${answered} of ${total} answered`;
}

function startTestTimer(seconds) {
  testTimeLeft = seconds;
  clearInterval(testTimerInterval);
  const el = document.getElementById('test-timer');
  testTimerInterval = setInterval(() => {
    testTimeLeft--;
    const m = Math.floor(testTimeLeft/60).toString().padStart(2,'0');
    const s = (testTimeLeft%60).toString().padStart(2,'0');
    el.textContent = `${m}:${s}`;
    if (testTimeLeft <= 60) el.classList.add('test-timer--warning');
    if (testTimeLeft <= 0) { clearInterval(testTimerInterval); submitTest(true); }
  }, 1000);
}

function confirmAbortTest() {
  if (confirm('Are you sure you want to abort? Your answers will be lost.')) {
    clearInterval(testTimerInterval);
    closeModal('test-modal');
    currentTestId=null; currentAttemptId=null; testAnswers={};
  }
}

async function submitTest(autoSubmit=false) {
  if (!currentAttemptId) return;
  clearInterval(testTimerInterval);

  const answersArr = Object.entries(testAnswers).map(([qid, ans]) => ({
    question_id: parseInt(qid), chosen_ans: ans
  }));

  try {
    const result = await apiFetch('tests.php?action=submit','POST',{
      attempt_id: currentAttemptId,
      answers: answersArr
    });
    closeModal('test-modal');
    showTestResult(result, document.getElementById('test-modal-title').textContent);
    // Refresh tests list
    loadMyTests();
  } catch(err) {
    showToast('Failed to submit: '+err.message);
  }
}

function showTestResult(result, title) {
  document.getElementById('result-test-title').textContent = title;
  document.getElementById('result-summary').innerHTML = `
    <div class="result-summary__item"><div class="val">${result.score}</div><div class="lbl">Score</div></div>
    <div class="result-summary__item"><div class="val">${result.total_marks}</div><div class="lbl">Total</div></div>
    <div class="result-summary__item"><div class="val">${result.percent.toFixed(1)}%</div><div class="lbl">Percent</div></div>
    <div class="result-summary__item"><div class="val">${result.passed?'Pass':'Fail'}</div><div class="lbl">Result</div></div>`;

  document.getElementById('result-answers').innerHTML = `
    <div class="result-pass-banner ${result.passed?'pass':'fail'}">${result.message}</div>`;

  openModal('test-result-modal');
}

async function viewMyResults(testId, title) {
  try {
    const d = await apiFetch(`tests.php?action=results&test_id=${testId}&user_id=${U.id}`);
    if (!d.attempt) { showToast('No results found.'); return; }
    const a = d.attempt;
    document.getElementById('result-test-title').textContent = title;
    document.getElementById('result-summary').innerHTML = `
      <div class="result-summary__item"><div class="val">${a.score}</div><div class="lbl">Score</div></div>
      <div class="result-summary__item"><div class="val">${a.total_marks}</div><div class="lbl">Total</div></div>
      <div class="result-summary__item"><div class="val">${parseFloat(a.percent).toFixed(1)}%</div><div class="lbl">Percent</div></div>
      <div class="result-summary__item"><div class="val">${a.passed=='1'?'Pass':'Fail'}</div><div class="lbl">Result</div></div>`;

    document.getElementById('result-answers').innerHTML =
      `<div class="result-pass-banner ${a.passed=='1'?'pass':'fail'}">${a.passed=='1'?'You Passed!':'Not Passed'} — ${parseFloat(a.percent).toFixed(1)}%</div>` +
      (a.answers||[]).map((ans,i) => `
        <div class="result-answer-block">
          <div class="q-text">Q${i+1}. ${esc(ans.question_text)}</div>
          ${ans.image_path ? `<img src="${BASE_URL}/${esc(ans.image_path)}" style="max-height:100px;border-radius:6px;margin-bottom:6px"/>` : ''}
          <div class="ans-row">
            <span>Your answer: <strong class="${ans.is_correct?'ans-correct':'ans-wrong'}">${(ans.chosen_ans||'—').toUpperCase()}</strong></span>
            <span style="margin-left:16px">Correct: <strong class="ans-correct">${ans.correct_ans.toUpperCase()}</strong></span>
            <span style="margin-left:16px">${ans.is_correct?'✓ Correct':'✗ Wrong'}</span>
          </div>
        </div>`).join('');

    openModal('test-result-modal');
  } catch(err) { showToast('Could not load results.'); }
}

/* ── Teacher: Test Management ───────────────────────────────── */
async function loadTeacherTests() {
  const list  = document.getElementById('t-tests-list');
  const empty = document.getElementById('t-tests-empty');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-m);font-size:14px">Loading…</p>';
  try {
    const d = await apiFetch(`tests.php?action=teacher&teacher_id=${U.id}`);
    if (!d.tests.length) { list.innerHTML=''; empty.style.display='block'; return; }
    empty.style.display='none';
    list.innerHTML = d.tests.map(t => `
      <div class="test-card">
        <div class="test-card__info">
          <div class="test-card__title">${esc(t.title)}</div>
          <div class="test-card__meta">
            <span>${esc(t.course_title)}</span>
            <span>${t.total_questions} questions</span>
            <span>${t.duration_min} min</span>
            <span>Pass: ${t.pass_percent}%</span>
          </div>
        </div>
        <div class="test-card__score">${t.total_attempts}<small>Attempts</small></div>
        <div class="test-card__actions">
          <button class="btn btn--outline btn--sm" onclick="viewTestQuestions(${t.id},'${esc(t.title)}')">Questions</button>
          <button class="btn btn--outline btn--sm" onclick="viewTestStudentResults(${t.id},'${esc(t.title)}')">Results</button>
          <button class="btn btn--ghost btn--sm" style="color:#ef4444" onclick="deleteTest(${t.id})">Delete</button>
        </div>
      </div>`).join('');
  } catch(err) { list.innerHTML='<p style="color:red">Failed to load tests.</p>'; }
}

async function openCreateTestModal() {
  // Populate course dropdown with teacher's courses
  const sel = document.getElementById('ct-course');
  sel.innerHTML = '<option value="">-- Choose Course --</option>';

  // allCourses is only populated on the explore tab; fetch if needed
  if (!allCourses.length) {
    try {
      const d = await apiFetch(`courses.php?user_id=${U.id}`);
      allCourses = d.courses || [];
    } catch(e) { /* non-fatal, dropdown will just be empty */ }
  }

  allCourses.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${esc(c.title)}</option>`;
  });
  document.getElementById('ct-title').value='';
  document.getElementById('ct-desc').value='';
  document.getElementById('ct-duration').value='30';
  document.getElementById('ct-pass').value='50';
  document.getElementById('ct-attempts').value='1';
  document.getElementById('ct-error').textContent='';
  openModal('create-test-modal');
}

async function createTest() {
  const cid   = document.getElementById('ct-course').value;
  const title = document.getElementById('ct-title').value.trim();
  const desc  = document.getElementById('ct-desc').value.trim();
  const dur   = document.getElementById('ct-duration').value;
  const pass  = document.getElementById('ct-pass').value;
  const maxA  = document.getElementById('ct-attempts').value;
  const errEl = document.getElementById('ct-error');

  if (!cid)   { errEl.textContent='Please select a course.'; return; }
  if (!title) { errEl.textContent='Title is required.'; return; }
  errEl.textContent='';

  try {
    const d = await apiFetch('tests.php?action=create_test','POST',{
      course_id:parseInt(cid), teacher_id:U.id,
      title, description:desc,
      duration_min:parseInt(dur), pass_percent:parseInt(pass), max_attempts:parseInt(maxA)
    });
    closeModal('create-test-modal');
    showToast('Test created! Now add questions.');
    openAddQuestionModal(d.test_id, title);
    loadTeacherTests();
  } catch(err) { errEl.textContent = err.message; }
}

async function viewTestQuestions(testId, title) {
  currentViewTestId    = testId;
  currentViewTestTitle = title;
  document.getElementById('vt-title').textContent = title;
  document.getElementById('vt-meta').textContent  = 'Loading questions…';
  openModal('view-test-modal');
  try {
    const d = await apiFetch(`tests.php?action=questions&test_id=${testId}&role=teacher`);
    document.getElementById('vt-meta').textContent = `${d.questions.length} question(s)`;
    document.getElementById('vt-questions-list').innerHTML = d.questions.length
      ? d.questions.map((q,i)=>`
          <div class="vt-question-item">
            <div class="vt-question-item__num">Q${i+1}</div>
            <div class="vt-question-item__body">
              ${q.image_path?`<img src="${BASE_URL}/${esc(q.image_path)}" style="max-height:80px;border-radius:6px;margin-bottom:6px"/>`:'' }
              <div class="vt-question-item__text">${esc(q.question_text)}</div>
              <div class="vt-question-item__opts">
                <span>A: ${esc(q.option_a)}</span><span>B: ${esc(q.option_b)}</span>
                <span>C: ${esc(q.option_c)}</span><span>D: ${esc(q.option_d)}</span>
              </div>
              <div class="vt-question-item__ans">Correct: ${q.correct_ans.toUpperCase()} · ${q.marks} mark(s)</div>
            </div>
            <button class="btn btn--ghost btn--sm" style="color:#ef4444;flex-shrink:0" onclick="deleteQuestion(${q.id},${testId},'${esc(title)}')">Remove</button>
          </div>`).join('')
      : '<p style="color:var(--text-m);font-size:14px">No questions yet. Add one below.</p>';
  } catch(e) { document.getElementById('vt-questions-list').innerHTML='<p style="color:red">Failed to load.</p>'; }
}

async function deleteQuestion(qid, testId, title) {
  if (!confirm('Remove this question?')) return;
  try {
    await apiFetch('tests.php?action=delete_question','DELETE',{id:qid});
    showToast('Question removed.');
    viewTestQuestions(testId, title);
    loadTeacherTests();
  } catch(e) { showToast('Failed to remove question.'); }
}

async function deleteTest(testId) {
  if (!confirm('Delete this test and all its questions? This cannot be undone.')) return;
  try {
    await apiFetch('tests.php?action=delete_test','DELETE',{id:testId});
    showToast('Test deleted.');
    loadTeacherTests();
  } catch(e) { showToast('Failed to delete test.'); }
}

function openAddQuestionModal(testId, title) {
  currentViewTestId    = testId;
  currentViewTestTitle = title;
  // Close any currently open modal so add-question-modal is always on top
  closeModal('view-test-modal');
  closeModal('create-test-modal');
  document.getElementById('aq-test-title').textContent = title;
  document.getElementById('aq-text').value='';
  document.getElementById('aq-opt-a').value='';
  document.getElementById('aq-opt-b').value='';
  document.getElementById('aq-opt-c').value='';
  document.getElementById('aq-opt-d').value='';
  document.getElementById('aq-correct').value='a';
  document.getElementById('aq-marks').value='1';
  document.getElementById('aq-error').textContent='';
  document.getElementById('aq-image').value='';
  document.getElementById('aq-image-preview').style.display='none';
  openModal('add-question-modal');
}

// Image preview for question
document.addEventListener('DOMContentLoaded', ()=>{
  const imgInput = document.getElementById('aq-image');
  if (imgInput) {
    imgInput.addEventListener('change', ()=>{
      const file = imgInput.files[0];
      if (!file) { document.getElementById('aq-image-preview').style.display='none'; return; }
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('aq-img-prev').src = e.target.result;
        document.getElementById('aq-image-preview').style.display='block';
      };
      reader.readAsDataURL(file);
    });
  }
});

async function submitAddQuestion() {
  const testId = currentViewTestId;
  const text   = document.getElementById('aq-text').value.trim();
  const oa     = document.getElementById('aq-opt-a').value.trim();
  const ob     = document.getElementById('aq-opt-b').value.trim();
  const oc     = document.getElementById('aq-opt-c').value.trim();
  const od     = document.getElementById('aq-opt-d').value.trim();
  const ans    = document.getElementById('aq-correct').value;
  const marks  = document.getElementById('aq-marks').value;
  const errEl  = document.getElementById('aq-error');
  const imgFile= document.getElementById('aq-image').files[0];

  if (!text)         { errEl.textContent='Question text is required.'; return; }
  if (!oa||!ob||!oc||!od) { errEl.textContent='All 4 options are required.'; return; }
  errEl.textContent='';

  const fd = new FormData();
  fd.append('test_id', testId);
  fd.append('question_text', text);
  fd.append('option_a', oa);
  fd.append('option_b', ob);
  fd.append('option_c', oc);
  fd.append('option_d', od);
  fd.append('correct_ans', ans);
  fd.append('marks', marks);
  if (imgFile) fd.append('image', imgFile);

  try {
    const res = await fetch(`${API}/tests.php?action=add_question`, { method:'POST', body: fd });
    const _txt = await res.text();
    let d;
    try { d = JSON.parse(_txt); } catch(e) { throw new Error('Server error: ' + _txt.replace(/<[^>]+>/g,'').trim().slice(0,200)); }
    if (!res.ok || d.error) throw new Error(d.error || 'Failed');
    showToast('Question added!');
    closeModal('add-question-modal');
    // Re-open the view modal with refreshed questions
    viewTestQuestions(testId, currentViewTestTitle);
    loadTeacherTests();
  } catch(err) { errEl.textContent = err.message; }
}

async function viewTestStudentResults(testId, title) {
  document.getElementById('ts-modal-title').textContent = `Results — ${title}`;
  document.getElementById('ts-results-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-m)">Loading…</td></tr>';
  openModal('test-students-modal');
  try {
    const d = await apiFetch(`tests.php?action=all_results&test_id=${testId}`);
    if (!d.results.length) {
      document.getElementById('ts-results-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-m)">No attempts yet.</td></tr>';
      return;
    }
    document.getElementById('ts-results-tbody').innerHTML = d.results.map(r => `
      <tr>
        <td><strong>${esc(r.student_name)}</strong><br><small style="color:var(--text-m)">${esc(r.student_email)}</small></td>
        <td>${r.score} / ${r.total_marks}</td>
        <td>${parseFloat(r.percent).toFixed(1)}%</td>
        <td><span class="badge ${r.passed=='1'?'badge--pass':'badge--fail'}">${r.passed=='1'?'Pass':'Fail'}</span></td>
        <td style="font-size:12px">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-IN') : '—'}</td>
      </tr>`).join('');
  } catch(e) { document.getElementById('ts-results-tbody').innerHTML='<tr><td colspan="5" style="color:red">Failed to load.</td></tr>'; }
}
