// DailyWork Unified Application Controller

// Global State
window.currentAppLang = localStorage.getItem('dailywork_lang') || 'en';
let currentRole = 'gateway'; // 'gateway', 'worker', 'admin'
let currentWorkerStep = 1;
let currentAdminStep = 1;
let currentWorkerCount = 3;
let currentWorkerTab = 'register'; // 'register' or 'availableJobs'
let authTargetRole = 'worker';
let tempOtpData = null;
let otpCountdownTimer = null;

// Current Session
let currentWorkerSession = JSON.parse(localStorage.getItem('dailywork_worker_user') || 'null');
let currentAdminSession = JSON.parse(localStorage.getItem('dailywork_admin_user') || 'null');

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Setup language selector in navbar
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = window.currentAppLang;
    langSelect.addEventListener('change', (e) => setAppLanguage(e.target.value));
  }

  // Set min date for work date inputs to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];
  const workDateInput = document.getElementById('workDate');
  if (workDateInput) {
    workDateInput.min = minDateStr;
    workDateInput.value = minDateStr;
  }

  // Apply saved language
  setAppLanguage(window.currentAppLang);

  // Setup Live Real-time Notification listeners
  setupLiveSyncListeners();

  // Determine initial role view
  const savedRole = localStorage.getItem('dailywork_active_role');
  if (savedRole === 'worker' && currentWorkerSession) {
    openWorkerPortal(false);
  } else if (savedRole === 'admin' && currentAdminSession) {
    openAdminPortal(false);
  } else {
    showGateway();
  }

  // Start admin countdown clock
  startAdminCountdown();
}

// --- GATEWAY & ROLE SWITCHING ---
function showGateway() {
  currentRole = 'gateway';
  localStorage.setItem('dailywork_active_role', 'gateway');
  document.getElementById('gatewayView').style.display = 'flex';
  document.getElementById('workerPortalView').style.display = 'none';
  document.getElementById('adminPortalView').style.display = 'none';
  document.getElementById('navBadgePortal').textContent = 'GATEWAY';
  document.getElementById('navRoleSwitchBtn').style.display = 'none';
  document.getElementById('navLogoutBtn').style.display = 'none';
  document.getElementById('adminUserPill').style.display = 'none';
  document.getElementById('notifBellBtn').style.display = 'none';
  window.api.stopLiveSync();
}

function handleWorkerRoleChoice() {
  // If worker is already verified, enter portal directly; otherwise prompt OTP
  if (currentWorkerSession && currentWorkerSession.mobile) {
    openWorkerPortal();
  } else {
    authTargetRole = 'worker';
    openOtpModal('worker');
  }
}

function handleAdminRoleChoice() {
  if (currentAdminSession && currentAdminSession.mobile) {
    openAdminPortal();
  } else {
    authTargetRole = 'admin';
    openAdminAuthModal();
  }
}

function switchRole() {
  showGateway();
}

function logout() {
  if (currentRole === 'worker') {
    currentWorkerSession = null;
    localStorage.removeItem('dailywork_worker_user');
  } else if (currentRole === 'admin') {
    currentAdminSession = null;
    localStorage.removeItem('dailywork_admin_user');
  }
  showToast("Logged out successfully");
  showGateway();
}

// --- OPEN WORKER PORTAL ---
function openWorkerPortal(saveRole = true) {
  currentRole = 'worker';
  if (saveRole) localStorage.setItem('dailywork_active_role', 'worker');

  document.getElementById('gatewayView').style.display = 'none';
  document.getElementById('adminPortalView').style.display = 'none';
  document.getElementById('workerPortalView').style.display = 'block';

  document.getElementById('navBadgePortal').textContent = t('nav.worker');
  document.getElementById('navRoleSwitchBtn').style.display = 'inline-flex';
  document.getElementById('navLogoutBtn').style.display = 'inline-flex';
  document.getElementById('adminUserPill').style.display = 'none';
  document.getElementById('notifBellBtn').style.display = 'none';

  // Pre-fill phone number from session if available
  if (currentWorkerSession && currentWorkerSession.mobile) {
    const mobInput = document.getElementById('mobile');
    if (mobInput && !mobInput.value) mobInput.value = currentWorkerSession.mobile;
    if (currentWorkerSession.name) {
      const nameInput = document.getElementById('fullName');
      if (nameInput && !nameInput.value) nameInput.value = currentWorkerSession.name;
    }
  }

  // Load available jobs
  loadAvailableJobsForWorker();

  // Start live sync for worker
  window.api.startLiveSync('worker');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- OPEN ADMIN PORTAL ---
function openAdminPortal(saveRole = true) {
  currentRole = 'admin';
  if (saveRole) localStorage.setItem('dailywork_active_role', 'admin');

  document.getElementById('gatewayView').style.display = 'none';
  document.getElementById('workerPortalView').style.display = 'none';
  document.getElementById('adminPortalView').style.display = 'block';

  document.getElementById('navBadgePortal').textContent = t('nav.admin');
  document.getElementById('navRoleSwitchBtn').style.display = 'inline-flex';
  document.getElementById('navLogoutBtn').style.display = 'inline-flex';
  document.getElementById('adminUserPill').style.display = 'flex';
  document.getElementById('notifBellBtn').style.display = 'flex';

  if (currentAdminSession && currentAdminSession.name) {
    document.getElementById('adminNameDisplay').textContent = currentAdminSession.name;
    const initials = currentAdminSession.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('adminAvatarDisplay').textContent = initials || 'AD';
  }

  // Show default admin page
  showAdminPage('dashboard');

  // Start live sync for admin notifications
  window.api.startLiveSync('admin');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- AUTH & OTP FLOW ---
function openOtpModal(role = 'worker') {
  authTargetRole = role;
  document.getElementById('otpModalTitle').textContent = role === 'worker' ? t('auth.worker.title') : t('auth.admin.title');
  document.getElementById('otpModalSub').textContent = role === 'worker' ? t('auth.worker.sub') : t('auth.admin.sub');
  document.getElementById('otpPhoneStep').style.display = 'block';
  document.getElementById('otpVerifyStep').style.display = 'none';
  document.getElementById('authMobileInput').value = '';
  clearOtpInputs();

  document.getElementById('authOtpModal').classList.add('show');
  setTimeout(() => document.getElementById('authMobileInput').focus(), 150);
}

function closeAuthModal() {
  document.getElementById('authOtpModal').classList.remove('show');
  document.getElementById('adminAuthModal').classList.remove('show');
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
}

async function requestOtp() {
  const phone = document.getElementById('authMobileInput').value.trim();
  if (!phone || phone.length < 10) {
    showToast("⚠️ Please enter a valid 10-digit mobile number");
    return;
  }

  const btn = document.getElementById('sendOtpBtn');
  btn.disabled = true;
  btn.textContent = "Sending...";

  try {
    const res = await window.api.sendOtp(phone);
    tempOtpData = res;

    // Show SMS notification drawer with test auto-fill
    showSimulatedSms(res.mobile, res.otp, res.real_sms_sent, res.provider, res.sms_status);

    // Switch to OTP entry step
    document.getElementById('otpPhoneStep').style.display = 'none';
    document.getElementById('otpVerifyStep').style.display = 'block';
    document.getElementById('otpSentToText').textContent = `+91 ${res.mobile}`;

    // Focus first OTP digit
    const firstDigit = document.getElementById('otp1');
    if (firstDigit) {
      firstDigit.focus();
    }

    startOtpCountdown(60);

    if (res.real_sms_sent) {
      showToast(`📲 Real SMS sent to +91 ${res.mobile} via ${res.provider}!`);
    } else if (res.sms_status && res.provider !== 'demo_simulator') {
      showToast(`⚠️ ${res.provider}: ${res.sms_status}`);
    } else {
      showToast(`✓ OTP code generated for +91 ${res.mobile}`);
    }
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Failed to send OTP'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = t('auth.btn.sendOtp');
  }
}

function handleOtpDigitInput(el, nextId, prevId) {
  if (el.value.length === 1 && nextId) {
    const nextEl = document.getElementById(nextId);
    if (nextEl) nextEl.focus();
  }
}

function handleOtpKeyDown(e, el, prevId) {
  if (e.key === 'Backspace' && !el.value && prevId) {
    const prevEl = document.getElementById(prevId);
    if (prevEl) prevEl.focus();
  }
}

function clearOtpInputs() {
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById('otp' + i);
    if (el) el.value = '';
  }
}

function getEnteredOtp() {
  let code = '';
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById('otp' + i);
    code += el ? el.value.trim() : '';
  }
  return code;
}

function autoFillOtp() {
  if (!tempOtpData || !tempOtpData.otp) {
    showToast("⚠️ No OTP pending");
    return;
  }
  const digits = String(tempOtpData.otp).split('');
  digits.forEach((d, idx) => {
    const el = document.getElementById('otp' + (idx + 1));
    if (el) el.value = d;
  });
  showToast("⚡ Test OTP Auto-Filled!");
}

function showSimulatedSms(mobile, otp, realSent = false, provider = 'demo_simulator', errorMsg = '') {
  const banner = document.getElementById('simulatedSmsBanner');
  document.getElementById('smsCodeHighlight').textContent = otp;
  document.getElementById('smsPhoneDisplay').textContent = mobile;
  const badge = banner.querySelector('.sms-badge');
  if (badge) {
    if (realSent) {
      badge.textContent = `REAL SMS SENT (${provider.toUpperCase()})`;
      badge.style.background = 'var(--accent2)';
    } else if (errorMsg && provider !== 'demo_simulator') {
      badge.textContent = `${provider.toUpperCase()} NOTICE: SEE BELOW`;
      badge.style.background = 'var(--accent3)';
    } else {
      badge.textContent = 'INCOMING SMS (TEST SIMULATOR)';
      badge.style.background = 'var(--accent)';
    }
  }
  banner.classList.add('show');
}

function closeSmsBanner() {
  document.getElementById('simulatedSmsBanner').classList.remove('show');
}

function startOtpCountdown(seconds) {
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  let remaining = seconds;
  const resendBtn = document.getElementById('resendOtpBtn');
  const timerSpan = document.getElementById('otpTimerSpan');

  resendBtn.disabled = true;
  resendBtn.style.opacity = '0.5';

  otpCountdownTimer = setInterval(() => {
    remaining--;
    if (timerSpan) timerSpan.textContent = `(${remaining}s)`;
    if (remaining <= 0) {
      clearInterval(otpCountdownTimer);
      resendBtn.disabled = false;
      resendBtn.style.opacity = '1';
      if (timerSpan) timerSpan.textContent = '';
    }
  }, 1000);
}

async function verifyEnteredOtp() {
  const phone = tempOtpData ? tempOtpData.mobile : document.getElementById('authMobileInput').value.trim();
  const otp = getEnteredOtp();

  if (!otp || otp.length < 6) {
    showToast("⚠️ Please enter the complete 6-digit OTP");
    return;
  }

  const btn = document.getElementById('verifyOtpBtn');
  btn.disabled = true;
  btn.textContent = "Verifying...";

  try {
    const res = await window.api.verifyOtp(phone, otp);

    closeAuthModal();
    closeSmsBanner();

    if (authTargetRole === 'worker') {
      currentWorkerSession = {
        mobile: phone,
        name: res.worker ? res.worker.name : '',
        id: res.worker ? res.worker.id : null,
        worker: res.worker
      };
      localStorage.setItem('dailywork_worker_user', JSON.stringify(currentWorkerSession));
      showToast("✓ Mobile number verified!");
      openWorkerPortal();

      // If already registered worker, show welcome back alert
      if (res.is_registered_worker && res.worker) {
        showToast(`👋 Welcome back, ${res.worker.name}!`);
      }
    } else if (authTargetRole === 'admin') {
      if (res.is_registered_admin && res.admin) {
        currentAdminSession = res.admin;
        localStorage.setItem('dailywork_admin_user', JSON.stringify(currentAdminSession));
        showToast(`👋 Welcome, ${res.admin.name}!`);
        openAdminPortal();
      } else {
        // New admin needs to set password and business details
        openAdminSignupDetailsModal(phone);
      }
    }
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Invalid OTP. Try again.'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = t('auth.btn.verify');
  }
}

// --- ADMIN PASSWORD LOGIN & SIGNUP ---
function openAdminAuthModal() {
  document.getElementById('adminAuthModal').classList.add('show');
  switchAdminAuthTab('login');
}

function switchAdminAuthTab(tab) {
  const loginForm = document.getElementById('adminLoginForm');
  const signupTabPrompt = document.getElementById('adminSignupTabPrompt');
  if (tab === 'login') {
    loginForm.style.display = 'block';
    signupTabPrompt.style.display = 'block';
  } else {
    document.getElementById('adminAuthModal').classList.remove('show');
    openOtpModal('admin');
  }
}

async function handleAdminPasswordLogin() {
  const mobile = document.getElementById('adminLoginMobile').value.trim();
  const password = document.getElementById('adminLoginPassword').value.trim();

  if (!mobile || !password) {
    showToast("⚠️ Mobile number and password are required");
    return;
  }

  try {
    const res = await window.api.adminLogin(mobile, password);
    currentAdminSession = res.admin;
    localStorage.setItem('dailywork_admin_user', JSON.stringify(currentAdminSession));
    document.getElementById('adminAuthModal').classList.remove('show');
    showToast(`✓ Welcome, ${res.admin.name}!`);
    openAdminPortal();
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Login failed'}`);
  }
}

function openAdminSignupDetailsModal(verifiedMobile) {
  document.getElementById('adminSignupDetailsModal').classList.add('show');
  document.getElementById('adminSignupMobile').value = verifiedMobile;
}

async function handleAdminDetailsSubmit() {
  const name = document.getElementById('adminSignupName').value.trim();
  const mobile = document.getElementById('adminSignupMobile').value.trim();
  const password = document.getElementById('adminSignupPassword').value.trim();
  const company = document.getElementById('adminSignupCompany').value.trim();
  const region = document.getElementById('adminSignupRegion').value;

  if (!name || !password) {
    showToast("⚠️ Please provide full name and password");
    return;
  }

  try {
    const res = await window.api.adminRegister({
      name, mobile, password, company, region
    });
    currentAdminSession = res.admin;
    localStorage.setItem('dailywork_admin_user', JSON.stringify(currentAdminSession));
    document.getElementById('adminSignupDetailsModal').classList.remove('show');
    showToast(`✓ Admin profile created for ${name}!`);
    openAdminPortal();
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Registration failed'}`);
  }
}

// --- WORKER PORTAL WIZARD ---
function switchWorkerTab(tab) {
  currentWorkerTab = tab;
  const regTab = document.getElementById('workerTabRegister');
  const jobsTab = document.getElementById('workerTabAvailableJobs');

  document.querySelectorAll('.worker-tab-btn').forEach(b => b.classList.remove('active'));

  if (tab === 'register') {
    document.querySelector('.worker-tab-btn:nth-child(1)').classList.add('active');
    regTab.style.display = 'block';
    jobsTab.style.display = 'none';
  } else {
    document.querySelector('.worker-tab-btn:nth-child(2)').classList.add('active');
    regTab.style.display = 'none';
    jobsTab.style.display = 'block';
    loadAvailableJobsForWorker();
  }
}

function goToWorkerStep(n) {
  if (n === 5) buildWorkerReview();
  document.querySelectorAll('#workerPortalView .pane').forEach(p => p.classList.remove('active'));
  const targetPane = document.getElementById('pane' + n);
  if (targetPane) targetPane.classList.add('active');
  currentWorkerStep = n;
  updateWorkerStepsUI(n);
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function updateWorkerStepsUI(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('s' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');

    if (i < 5) {
      const ln = document.getElementById('l' + i);
      if (ln) ln.classList.toggle('done', i < n);
    }
  }
}

function toggleSkill(el) { el.classList.toggle('selected'); }
function toggleDay(el) { el.classList.toggle('selected'); }
function toggleLangChip(el) { el.classList.toggle('active'); }

function pickRadioChip(group, el) {
  document.querySelectorAll('#' + group + ' .radio-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  if (group === 'radiusChips') {
    const disp = document.getElementById('radiusDisplay');
    if (disp) disp.textContent = el.textContent;
  }
}

function updateWage(val) {
  document.getElementById('wageVal').textContent = '₹' + val;
}

function handlePhotoUpload(input) {
  if (input.files && input.files[0]) {
    document.getElementById('photoIcon').textContent = '✅';
    document.getElementById('photoText').innerHTML = 'Photo uploaded: <span>' + input.files[0].name + '</span>';
  }
}

function buildWorkerReview() {
  const skills = [...document.querySelectorAll('.skill-tag.selected')].map(e => e.textContent.trim()).join(', ') || '—';
  const days = [...document.querySelectorAll('#dayGrid .day-btn.selected')].map(e => e.textContent.trim()).join(', ') || '—';
  const langs = [...document.querySelectorAll('#languages .radio-chip.active')].map(e => e.textContent.trim()).join(', ') || '—';
  const workMode = document.querySelector('#workMode .radio-chip.active')?.textContent.trim() || '—';
  const travel = document.querySelector('#travel .radio-chip.active')?.textContent.trim() || '—';
  const tools = document.querySelector('#tools .radio-chip.active')?.textContent.trim() || '—';

  const items = [
    { label: t('p1.name'), val: getVal('fullName') || '—' },
    { label: t('p1.mobile'), val: getVal('mobile') || '—' },
    { label: t('p1.age'), val: getVal('age') || '—' },
    { label: t('p1.gender'), val: getVal('gender') || '—' },
    { label: t('p1.address'), val: getVal('address') || '—', wide: true },
    { label: t('p2.primary'), val: getVal('primaryCategory') || '—', wide: true },
    { label: t('p2.additional'), val: skills, wide: true },
    { label: t('p2.mode'), val: workMode },
    { label: t('p2.wage'), val: document.getElementById('wageVal').textContent },
    { label: t('p3.years'), val: getVal('experience') || '—' },
    { label: t('p3.employer'), val: getVal('lastEmployer') || '—' },
    { label: t('p3.workdesc'), val: getVal('workDesc') || '—', wide: true },
    { label: t('p3.education'), val: getVal('education') || '—' },
    { label: t('p3.certs'), val: getVal('certs') || '—' },
    { label: t('p3.langs'), val: langs },
    { label: t('p4.days'), val: days, wide: true },
    { label: t('p4.start'), val: (getVal('startTime') || '8:00 AM') + ' – ' + (getVal('endTime') || '6:00 PM') },
    { label: t('p4.travel'), val: travel },
    { label: t('p4.tools'), val: tools }
  ];

  document.getElementById('reviewGrid').innerHTML = items.map(i =>
    `<div class="review-item ${i.wide ? 'wide' : ''}">
      <div class="r-label">${i.label}</div>
      <div class="r-val">${i.val}</div>
    </div>`
  ).join('');
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function submitWorkerRegistration() {
  if (!document.getElementById('consent').checked) {
    showToast("⚠️ Please accept the terms to complete registration");
    return;
  }

  const workerData = {
    name: getVal('fullName'),
    mobile: getVal('mobile'),
    age: parseInt(getVal('age')) || null,
    gender: getVal('gender'),
    address: getVal('address'),
    pincode: getVal('pin'),
    aadhar: getVal('aadhar'),
    primary_category: getVal('primaryCategory'),
    skills: [...document.querySelectorAll('.skill-tag.selected')].map(e => e.textContent.trim()),
    work_mode: document.querySelector('#workMode .radio-chip.active')?.textContent.trim(),
    wage: document.getElementById('wageVal').textContent,
    experience: getVal('experience'),
    last_employer: getVal('lastEmployer'),
    prev_location: getVal('prevLocation'),
    work_desc: getVal('workDesc'),
    projects: getVal('projects'),
    education: getVal('education'),
    certs: getVal('certs'),
    languages: [...document.querySelectorAll('#languages .radio-chip.active')].map(e => e.textContent.trim()),
    available_days: [...document.querySelectorAll('#dayGrid .day-btn.selected')].map(e => e.textContent.trim()),
    start_time: getVal('startTime'),
    end_time: getVal('endTime'),
    travel: document.querySelector('#travel .radio-chip.active')?.textContent.trim(),
    tools: document.querySelector('#tools .radio-chip.active')?.textContent.trim(),
    emergency_contact: getVal('emergContact'),
    status: 'Confirmed'
  };

  if (!workerData.name || !workerData.mobile) {
    showToast("⚠️ Full name and mobile are required");
    goToWorkerStep(1);
    return;
  }

  const btn = document.getElementById('submitRegBtn');
  btn.disabled = true;
  btn.textContent = "Submitting...";

  try {
    const res = await window.api.registerWorker(workerData);
    const workerId = res.worker.id;

    document.getElementById('workerIdDisplay').textContent = workerId;
    currentWorkerSession = { ...res.worker, mobile: res.worker.mobile };
    localStorage.setItem('dailywork_worker_user', JSON.stringify(currentWorkerSession));

    document.querySelectorAll('#workerPortalView .pane').forEach(p => p.classList.remove('active'));
    document.getElementById('paneSuccess').classList.add('active');
    document.querySelectorAll('#workerPortalView .step-item').forEach(s => s.classList.add('done'));
    document.querySelectorAll('#workerPortalView .step-line').forEach(l => l.classList.add('done'));

    showToast(`✓ Worker Registered: ${workerId}`);
    window.scrollTo({ top: 100, behavior: 'smooth' });
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Registration failed'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = `✓ ${t('btn.submit')}`;
  }
}

// --- WORKER AVAILABLE JOBS ---
async function loadAvailableJobsForWorker() {
  const container = document.getElementById('availableJobsList');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Loading available jobs near you...</div>`;

  try {
    const jobs = await window.api.getJobs();
    if (!jobs.length) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">${t('jobs.empty')}</div>`;
      return;
    }

    container.innerHTML = jobs.map(j => `
      <div class="job-item-card">
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="job-icon-box">${j.icon || '🏗'}</div>
          <div class="job-info-col">
            <div class="job-headline">
              ${j.work_type}
              <span class="status-pill ${j.status === 'live' ? 'status-live' : 'status-open'}">${j.status === 'live' ? '🟢 Live' : '🔔 Open'}</span>
            </div>
            <div class="job-subline">
              📍 <strong>${j.site_address}</strong> · 📅 ${j.work_date} · 🕗 ${j.start_time}
            </div>
            <div class="job-pills-row">
              <span class="job-pill">👷 ${j.registered_count || 0}/${j.worker_count} registered</span>
              <span class="job-pill">📡 Within ${j.radius || '10 km'}</span>
              <span class="job-pill">⏱ ${j.duration || 'Full day'}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="text-align:right">
            <div class="job-wage-badge">₹${j.daily_wage}/day</div>
            <div style="font-size:0.75rem;color:var(--muted)">Guaranteed Daily Pay</div>
          </div>
          <button class="btn-primary" style="padding:10px 22px;font-size:0.88rem" onclick="applyToJob('${j.id}')">
            ${t('btn.apply')}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger)">Error loading jobs. Please try again.</div>`;
  }
}

async function applyToJob(jobId) {
  if (!currentWorkerSession || !currentWorkerSession.id) {
    showToast("⚠️ Please complete your worker registration first to apply");
    switchWorkerTab('register');
    return;
  }

  try {
    await window.api.applyJob(jobId, currentWorkerSession.id);
    showToast("✓ Application submitted! Employer notified.");
    loadAvailableJobsForWorker();
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Application already submitted'}`);
  }
}

// --- ADMIN PORTAL CONTROLLER ---
function showAdminPage(pageId, linkEl = null) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('admin-page-' + pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll('.admin-sidebar .sidebar-link').forEach(l => l.classList.remove('active'));
  if (linkEl) {
    linkEl.classList.add('active');
  } else {
    const mapping = { dashboard: 1, 'post-job': 2, 'my-jobs': 3, registered: 5, 'live-list': 6, settings: 8 };
    const links = document.querySelectorAll('.admin-sidebar .sidebar-link');
    if (links[mapping[pageId] - 1]) links[mapping[pageId] - 1].classList.add('active');
  }

  if (pageId === 'dashboard') loadAdminDashboard();
  if (pageId === 'my-jobs') loadAdminMyJobs();
  if (pageId === 'registered') loadAdminRegisteredWorkers();
  if (pageId === 'live-list') loadAdminLiveList();
  if (pageId === 'settings') loadAdminSettings();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadAdminDashboard() {
  try {
    const stats = await window.api.getStats();
    document.getElementById('dashActiveJobs').textContent = stats.active_jobs;
    document.getElementById('dashWorkersReg').textContent = stats.total_workers;
    document.getElementById('dashActiveRegions').textContent = stats.active_regions;
    document.getElementById('sidebarRegCount').textContent = stats.total_workers;

    const jobs = await window.api.getJobs();
    const container = document.getElementById('dashboardJobsContainer');
    if (!container) return;

    container.innerHTML = jobs.slice(0, 3).map(j => `
      <div class="job-card">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="job-icon-box">${j.icon || '🏗'}</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem">${j.work_type}</div>
            <div style="font-size:0.8rem;color:var(--muted);margin-top:3px">
              📅 ${j.work_date} · 🕗 ${j.start_time} · 👷 <strong>${j.registered_count || 0}/${j.worker_count} registered</strong>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="job-pill">📍 ${j.district || 'Hyderabad'}</span>
              <span class="job-pill">📡 ${j.radius || '10 km'}</span>
              <span class="job-pill">₹${j.daily_wage}/day</span>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="status-pill ${j.status === 'live' ? 'status-live' : 'status-open'}">${j.status === 'live' ? '🟢 Live' : '🔔 Open'}</span>
          <button class="btn-secondary" style="padding:7px 16px;font-size:0.82rem" onclick="showAdminPage('registered')">View Workers</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// Post Job 3-step Wizard
function goAdminJobStep(n) {
  if (n === 3) buildAdminJobReview();
  for (let i = 1; i <= 3; i++) {
    const stepPane = document.getElementById('adminJStep' + i);
    if (stepPane) stepPane.style.display = i === n ? 'block' : 'none';

    const circle = document.getElementById('ajs' + i)?.querySelector('.step-circle');
    const label = document.getElementById('ajs' + i)?.querySelector('div:last-child');
    if (circle) {
      if (i < n) { circle.style.background = 'var(--accent2)'; circle.style.borderColor = 'var(--accent2)'; circle.style.color = '#0d0f0e'; }
      else if (i === n) { circle.style.background = 'var(--accent)'; circle.style.borderColor = 'var(--accent)'; circle.style.color = '#0d0f0e'; }
      else { circle.style.background = 'transparent'; circle.style.borderColor = 'var(--border)'; circle.style.color = 'var(--muted)'; }
    }
    if (label) label.style.color = i === n ? 'var(--accent)' : (i < n ? 'var(--accent2)' : 'var(--muted)');
  }
  currentAdminStep = n;
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

function selectAdminJobTypeChip(el) {
  document.querySelectorAll('#adminJobTypeChips .type-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function changeAdminWorkerCount(delta) {
  currentWorkerCount = Math.max(1, Math.min(50, currentWorkerCount + delta));
  document.getElementById('adminWorkerCount').textContent = currentWorkerCount;
}

function buildAdminJobReview() {
  const type = document.querySelector('#adminJobTypeChips .type-chip.selected')?.dataset.t || 'Construction & Building';
  const radius = document.querySelector('#adminRadiusChips .radio-chip.active')?.textContent.trim() || '10 km';
  const level = document.querySelector('#adminSkillLevel .radio-chip.active')?.textContent.trim() || 'Any';
  const date = getVal('workDate');
  const start = getVal('workStart') || '8:00 AM';
  const dur = getVal('workDur') || 'Full day (8 hrs)';
  const wage = getVal('wageOffer') || '550';
  const addr = getVal('siteAddr') || 'Site Address';
  const district = getVal('siteDistrict') || 'Hyderabad';
  const desc = getVal('jobDesc') || '—';

  const items = [
    { l: t('pj.cat'), v: type },
    { l: t('pj.count'), v: `${currentWorkerCount} workers` },
    { l: t('pj.skill'), v: level },
    { l: t('pj.date'), v: date },
    { l: t('pj.start'), v: start },
    { l: t('pj.dur'), v: dur },
    { l: t('pj.wage'), v: `₹${wage}` },
    { l: t('pj.site'), v: addr, wide: true },
    { l: t('pj.district'), v: district },
    { l: t('pj.radius'), v: radius },
    { l: t('pj.desc'), v: desc, wide: true }
  ];

  document.getElementById('adminJobReviewGrid').innerHTML = items.map(i =>
    `<div style="background:var(--surface);border-radius:12px;padding:14px;${i.wide ? 'grid-column:1/-1' : ''}">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px">${i.l}</div>
      <div style="font-weight:600;font-size:0.92rem;color:var(--text)">${i.v}</div>
    </div>`
  ).join('');
}

async function submitAdminJob() {
  if (!document.getElementById('adminJobConsent').checked) {
    showToast("⚠️ Please accept the contractor terms of engagement");
    return;
  }

  const jobPayload = {
    work_type: document.querySelector('#adminJobTypeChips .type-chip.selected')?.dataset.t || 'Construction & Building',
    worker_count: currentWorkerCount,
    skill_level: document.querySelector('#adminSkillLevel .radio-chip.active')?.textContent.trim() || 'Any',
    work_date: getVal('workDate'),
    start_time: getVal('workStart'),
    duration: getVal('workDur'),
    daily_wage: getVal('wageOffer') || '550',
    job_desc: getVal('jobDesc'),
    special_req: getVal('specialReq'),
    site_address: getVal('siteAddr'),
    pincode: getVal('sitePincode'),
    landmark: getVal('siteLandmark'),
    district: getVal('siteDistrict'),
    radius: document.querySelector('#adminRadiusChips .radio-chip.active')?.textContent.trim() || '10 km'
  };

  try {
    const res = await window.api.postJob(jobPayload);
    document.getElementById('postedJobIdDisplay').textContent = res.job.id;
    document.getElementById('adminSuccessModal').classList.add('show');
    showToast(`✓ Job request posted: ${res.job.id}`);
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Error posting job'}`);
  }
}

function closeAdminSuccessModal(postAnother = false) {
  document.getElementById('adminSuccessModal').classList.remove('show');
  if (postAnother) {
    goAdminJobStep(1);
  } else {
    showAdminPage('my-jobs');
  }
}

async function loadAdminMyJobs() {
  const container = document.getElementById('myJobsList');
  if (!container) return;

  try {
    const jobs = await window.api.getJobs();
    container.innerHTML = jobs.map(j => `
      <div class="job-card">
        <div style="display:flex;align-items:center;gap:16px">
          <div class="job-icon-box">${j.icon || '🏗'}</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1.05rem">
              ${j.work_type} — <span style="color:var(--accent)">${j.worker_count} workers needed</span>
            </div>
            <div style="font-size:0.82rem;color:var(--muted);margin-top:3px">
              📅 ${j.work_date} · 🕗 ${j.start_time} · ₹${j.daily_wage}/day
            </div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="job-pill">📍 ${j.site_address}</span>
              <span class="job-pill">📡 Within ${j.radius}</span>
              <span class="job-pill">👷 ${j.registered_count || 0} registered</span>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="status-pill ${j.status === 'live' ? 'status-live' : 'status-open'}">${j.status === 'live' ? '🟢 Live' : '🔔 Open'}</span>
          <button class="confirm-btn" onclick="showAdminPage('registered')">See Workers</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// Registered Workers Table
let cachedWorkers = [];

async function loadAdminRegisteredWorkers() {
  try {
    const q = document.getElementById('workerSearchInput')?.value.trim() || '';
    const trade = document.getElementById('filterTradeSelect')?.value || '';
    const status = document.getElementById('filterStatusSelect')?.value || '';

    const workers = await window.api.getWorkers(q, trade, status);
    cachedWorkers = workers;
    renderWorkersTable(workers);
  } catch (err) {
    console.error(err);
  }
}

function renderWorkersTable(workers) {
  const tbody = document.getElementById('workersTableBody');
  if (!tbody) return;

  if (!workers.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No registered workers found matching your criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = workers.map(w => {
    const initials = (w.name || 'W').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `
      <tr>
        <td>
          <div class="worker-name-cell">
            <div class="worker-avatar">${initials}</div>
            <div>
              <div class="wname">${w.name}</div>
              <div class="wmobile">${w.mobile}</div>
            </div>
          </div>
        </td>
        <td>${w.primary_category}</td>
        <td>${w.experience || '1–2 years'}</td>
        <td><span class="dist-badge">📍 ${w.travel || 'Local area'}</span></td>
        <td style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent)">${w.wage || '₹500'}</td>
        <td>${Array.isArray(w.available_days) ? w.available_days.slice(0, 3).join(', ') : 'Mon–Sat'}</td>
        <td><span class="status-pill ${w.status === 'Confirmed' ? 'status-filling' : 'status-open'}" style="font-size:0.72rem">${w.status}</span></td>
        <td>
          ${w.status === 'Confirmed'
            ? `<span class="confirmed-tag">✓ Confirmed</span>`
            : `<button class="confirm-btn" onclick="confirmWorkerAction('${w.id}')">Confirm</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function confirmWorkerAction(workerId) {
  try {
    // Default job confirmation
    await window.api.confirmWorker('JOB-482910', workerId);
    showToast("✓ Worker confirmed for site assignment!");
    loadAdminRegisteredWorkers();
  } catch (err) {
    showToast(`⚠️ ${err.message || 'Error confirming worker'}`);
  }
}

// Live Work List (1 hour before work)
async function loadAdminLiveList() {
  const tbody = document.getElementById('liveTableBody');
  if (!tbody) return;

  try {
    const workers = await window.api.getWorkers('', '', 'Confirmed');
    if (!workers.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No confirmed workers on roster yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = workers.map((w, idx) => {
      const initials = (w.name || 'W').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const skillsHtml = Array.isArray(w.skills) ? w.skills.map(s => `<span class="job-pill" style="font-size:0.68rem">${s}</span>`).join('') : '';
      return `
        <tr>
          <td style="color:var(--muted);font-family:'Syne',sans-serif;font-weight:700">${String(idx + 1).padStart(2, '0')}</td>
          <td>
            <div class="worker-name-cell">
              <div class="worker-avatar">${initials}</div>
              <div><div class="wname">${w.name}</div><div class="wmobile">${w.mobile}</div></div>
            </div>
          </td>
          <td>${w.primary_category}</td>
          <td>${w.experience || '1–2 years'}</td>
          <td>${skillsHtml || 'General'}</td>
          <td><span class="dist-badge">📍 3.5 km</span></td>
          <td style="color:var(--accent2);font-weight:600">${w.mobile}</td>
          <td style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent)">${w.wage}/day</td>
          <td><span class="status-pill status-live" style="font-size:0.7rem;padding:4px 10px">✓ On-site</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

function broadcastSmsToWorkers() {
  showToast("📱 Automated SMS dispatched to all confirmed workers!");
}

function printDispatchRoster() {
  window.print();
}

function copyRosterToClipboard() {
  const text = cachedWorkers.map(w => `${w.name}: ${w.mobile} (${w.primary_category})`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Worker roster copied to clipboard!");
  });
}

function loadAdminSettings() {
  if (currentAdminSession) {
    const fn = document.getElementById('settingsFullName');
    const mob = document.getElementById('settingsMobile');
    const comp = document.getElementById('settingsCompany');
    if (fn) fn.value = currentAdminSession.name || 'Suresh Kumar';
    if (mob) mob.value = currentAdminSession.mobile ? `+91 ${currentAdminSession.mobile}` : '+91 98765 43210';
    if (comp) comp.value = currentAdminSession.company || 'SK Constructions Pvt Ltd';
  }
}

function saveAdminSettings() {
  showToast("✅ Settings updated successfully!");
}

// Countdown Timer in Admin
function startAdminCountdown() {
  let total = 13 * 3600 + 45 * 60 + 22;
  setInterval(() => {
    if (total <= 0) return;
    total--;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hEl = document.getElementById('ct-h');
    const mEl = document.getElementById('ct-m');
    const sEl = document.getElementById('ct-s');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
  }, 1000);
}

// --- LIVE SYNC & NOTIFICATION HUB ---
function setupLiveSyncListeners() {
  window.api.on('worker_registered', (notif) => {
    showLiveAlert(notif);
    // Refresh admin tables if currently in admin mode
    if (currentRole === 'admin') {
      loadAdminDashboard();
      loadAdminRegisteredWorkers();
    }
  });

  window.api.on('worker_applied', (notif) => {
    showLiveAlert(notif);
    if (currentRole === 'admin') {
      loadAdminDashboard();
      loadAdminRegisteredWorkers();
    }
  });

  window.api.on('job_posted', (notif) => {
    showLiveAlert(notif);
    if (currentRole === 'worker') {
      loadAvailableJobsForWorker();
    }
  });
}

function showLiveAlert(notif) {
  const toast = document.getElementById('liveNotifToast');
  if (!toast) return;
  document.getElementById('liveNotifTitle').textContent = notif.title;
  document.getElementById('liveNotifDesc').textContent = notif.message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// --- MULTILINGUAL CONTROLLER ---
function t(key) {
  return getTranslation(window.currentAppLang, key);
}

function setAppLanguage(lang) {
  window.currentAppLang = lang;
  localStorage.setItem('dailywork_lang', lang);
  document.documentElement.lang = lang;

  const langSelect = document.getElementById('langSelect');
  if (langSelect && langSelect.value !== lang) {
    langSelect.value = lang;
  }

  // Translate all [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.querySelector('.required')) {
      el.innerHTML = val + ' <span class="required" style="color:var(--accent)">*</span>';
    } else {
      el.textContent = val;
    }
  });

  // Translate [data-i18n-html]
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key);
  });

  // Translate [data-i18n-ph] (placeholders)
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    el.setAttribute('placeholder', t(key));
  });

  // Update dynamic badges
  if (currentRole === 'worker') {
    document.getElementById('navBadgePortal').textContent = t('nav.worker');
  } else if (currentRole === 'admin') {
    document.getElementById('navBadgePortal').textContent = t('nav.admin');
  }

  showToast(`✓ Language: ${document.getElementById('langSelect')?.selectedOptions[0]?.text || lang.toUpperCase()}`);
}

// Speech Triggers
function speakTextAloud(text) {
  window.speechEngine.speak(text, window.currentAppLang);
}

function speakLabelAloud(btn, targetSelector) {
  window.speechEngine.speakElement(btn, targetSelector, window.currentAppLang);
}

function startVoiceInput(targetInputId, btn) {
  window.speechEngine.listen(targetInputId, btn, window.currentAppLang);
}

// General Toast
function showToast(msg) {
  const tEl = document.getElementById('toast');
  if (!tEl) return;
  tEl.textContent = msg;
  tEl.classList.add('show');
  setTimeout(() => tEl.classList.remove('show'), 3000);
}
