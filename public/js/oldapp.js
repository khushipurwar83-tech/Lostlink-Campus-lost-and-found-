// ============================================================
// app.js — All frontend logic for Campus Lost & Found
// This file handles: auth, fetching items, posting, claims, etc.
// ============================================================

// ── Configuration ─────────────────────────────────────────
// Change this if your backend runs on a different port
const API_BASE = 'http://localhost:5000/api';

// ── State: Things we remember while the app is running ────
let currentUser = null;   // Logged-in user info
let authToken = null;     // JWT token for API calls
let currentPage = 1;      // Current page of results
let totalPages = 1;       // Total pages available
let searchTimeout = null; // Timer for search debounce

// Category icons for visual flair
const CATEGORY_ICONS = {
  'Electronics': '📱',
  'Clothing & Accessories': '👕',
  'Books & Stationery': '📚',
  'ID & Documents': '🪪',
  'Keys': '🔑',
  'Bags & Wallets': '👜',
  'Sports Equipment': '⚽',
  'Jewelry': '💍',
  'Other': '📦'
};

// ═══════════════════════════════════════════════════════════
//  INITIALIZATION — Runs when page loads
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in (token saved in localStorage)
  const savedToken = localStorage.getItem('lnf_token');
  const savedUser = localStorage.getItem('lnf_user');

  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = JSON.parse(savedUser);
    showApp();
  } else {
    showAuthScreen();
  }

  // Load public stats for the auth screen
  loadPublicStats();

  // Set up form event listeners
  setupFormListeners();
});

// ── Set max date for date inputs to today ─────────────────
function setDateInputMax() {
  const today = new Date().toISOString().split('T')[0];
  const postDate = document.getElementById('post-date');
  if (postDate) postDate.max = today;
}

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════

function setupFormListeners() {
  // Switch between Login / Register tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${target}-form`).classList.add('active');
    });
  });

  // Login form submission
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Register form submission
  document.getElementById('register-form').addEventListener('submit', handleRegister);

  // Post item form submission
  document.getElementById('post-form').addEventListener('submit', handlePostItem);

  // Claim form submission
  document.getElementById('claim-form').addEventListener('submit', handleSubmitClaim);
}

async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const collegeId = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-pass').value;

  try {
    const data = await apiCall('/auth/login', 'POST', { collegeId, password }, false);
    saveAuth(data.token, data.user);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';

  const payload = {
    collegeId: document.getElementById('reg-id').value.trim(),
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-pass').value,
    department: document.getElementById('reg-dept').value.trim(),
    phone: document.getElementById('reg-phone').value.trim()
  };

  try {
    const data = await apiCall('/auth/register', 'POST', payload, false);
    saveAuth(data.token, data.user);
    showApp();
    showToast('Welcome! Account created successfully 🎉', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function saveAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('lnf_token', token);
  localStorage.setItem('lnf_user', JSON.stringify(user));
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('lnf_token');
  localStorage.removeItem('lnf_user');
  showAuthScreen();
}

// ═══════════════════════════════════════════════════════════
//  SCREEN & PAGE NAVIGATION
// ═══════════════════════════════════════════════════════════

function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
}

function showApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('nav-user-name').textContent = currentUser.name;
  setDateInputMax();
  showPage('feed');
}

function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Show selected page
  document.getElementById(`page-${pageName}`).classList.add('active');
  const navBtn = document.getElementById(`nav-${pageName}`);
  if (navBtn) navBtn.classList.add('active');

  // Load content for the page
  if (pageName === 'feed') {
    loadFeed();
  } else if (pageName === 'my-posts') {
    loadMyPosts();
  } else if (pageName === 'my-claims') {
    loadMyClaims();
  }
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════
//  FEED / ITEMS
// ═══════════════════════════════════════════════════════════

async function loadFeed(page = 1) {
  currentPage = page;
  const grid = document.getElementById('items-grid');
  const loading = document.getElementById('feed-loading');
  const empty = document.getElementById('feed-empty');
  const resultsCount = document.getElementById('results-count');

  // Show loading, hide others
  grid.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  // Build query string from filters
  const params = new URLSearchParams({
    page,
    limit: 12,
    type: document.getElementById('filter-type').value,
    category: document.getElementById('filter-category').value,
    location: document.getElementById('filter-location').value,
    dateFrom: document.getElementById('filter-date-from').value,
    dateTo: document.getElementById('filter-date-to').value,
    search: document.getElementById('search-input').value,
  });

  // Remove empty params
  for (const [key, value] of [...params.entries()]) {
    if (!value) params.delete(key);
  }

  try {
    const data = await apiCall(`/items?${params}`, 'GET', null, true);
    loading.classList.add('hidden');

    if (data.items.length === 0) {
      empty.classList.remove('hidden');
      resultsCount.textContent = '0 results';
    } else {
      resultsCount.textContent = `${data.totalItems} result${data.totalItems !== 1 ? 's' : ''}`;
      data.items.forEach(item => {
        grid.appendChild(createItemCard(item));
      });
      totalPages = data.totalPages;
      renderPagination(data.currentPage, data.totalPages);
    }

  } catch (err) {
    loading.classList.add('hidden');
    grid.innerHTML = `<p style="color:var(--lost);padding:32px">${err.message}</p>`;
  }
}

function createItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.onclick = () => openDetailModal(item._id);

  const icon = CATEGORY_ICONS[item.category] || '📦';
  const dateStr = new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const postedAgo = timeAgo(item.createdAt);
  const isResolved = item.status === 'resolved';

  card.innerHTML = `
    ${item.photo
      ? `<img class="card-photo" src="${API_BASE.replace('/api','')}${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy"/>`
      : `<div class="card-no-photo">${icon}</div>`
    }
    <div class="card-body">
      <div class="card-badges">
        <span class="badge badge-${item.type}">${item.type === 'lost' ? '🔴 Lost' : '🟢 Found'}</span>
        <span class="badge badge-category">${item.category}</span>
        ${isResolved ? '<span class="badge badge-resolved">✓ Resolved</span>' : ''}
      </div>
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="card-desc">${escapeHtml(item.description)}</div>
      <div class="card-meta">
        <span>📍 ${escapeHtml(item.location)}</span>
        <span>📅 ${dateStr}</span>
      </div>
    </div>
    <div class="card-poster">
      <span>👤 ${escapeHtml(item.postedBy?.name || 'Unknown')} · ${escapeHtml(item.postedBy?.collegeId || '')}</span>
      <span style="color:var(--text3);font-size:11px">${postedAgo}</span>
    </div>
  `;

  return card;
}

// ── Filters & Search ───────────────────────────────────────

function applyFilters() {
  loadFeed(1); // Reset to page 1 when filters change
}

function debounceSearch() {
  // Wait 400ms after user stops typing before searching
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => applyFilters(), 400);
}

function clearFilters() {
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-location').value = '';
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  document.getElementById('search-input').value = '';
  applyFilters();
}

// ── Pagination ─────────────────────────────────────────────

function renderPagination(current, total) {
  const container = document.getElementById('pagination');
  container.innerHTML = '';
  if (total <= 1) return;

  // Previous button
  if (current > 1) {
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '←';
    prev.onclick = () => loadFeed(current - 1);
    container.appendChild(prev);
  }

  // Page number buttons
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 2) {
      const btn = document.createElement('button');
      btn.className = `page-btn${i === current ? ' active' : ''}`;
      btn.textContent = i;
      btn.onclick = () => loadFeed(i);
      container.appendChild(btn);
    } else if (Math.abs(i - current) === 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.cssText = 'color:var(--text3);padding:0 4px;line-height:36px';
      container.appendChild(dots);
    }
  }

  // Next button
  if (current < total) {
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '→';
    next.onclick = () => loadFeed(current + 1);
    container.appendChild(next);
  }
}

// ═══════════════════════════════════════════════════════════
//  POST ITEM MODAL
// ═══════════════════════════════════════════════════════════

function openPostModal(itemData = null) {
  const title = document.getElementById('post-modal-title');
  const submitBtn = document.getElementById('post-submit-btn');
  const form = document.getElementById('post-form');

  // Reset form
  form.reset();
  document.getElementById('edit-item-id').value = '';
  document.getElementById('post-error').textContent = '';
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('photo-placeholder').style.display = 'flex';

  if (itemData) {
    // Pre-fill for edit mode
    title.textContent = 'Edit Post';
    submitBtn.textContent = 'Save Changes →';
    document.getElementById('edit-item-id').value = itemData._id;
    document.getElementById('post-type').value = itemData.type;
    document.getElementById('post-category').value = itemData.category;
    document.getElementById('post-title').value = itemData.title;
    document.getElementById('post-desc').value = itemData.description;
    document.getElementById('post-location').value = itemData.location;
    document.getElementById('post-date').value = itemData.date?.split('T')[0];
  } else {
    title.textContent = 'Post an Item';
    submitBtn.textContent = 'Submit Post →';
    // Default date to today
    document.getElementById('post-date').value = new Date().toISOString().split('T')[0];
  }

  openModal('post-modal');
}

function previewPhoto() {
  const file = document.getElementById('post-photo').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('photo-preview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    document.getElementById('photo-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function handlePostItem(e) {
  e.preventDefault();
  const errorEl = document.getElementById('post-error');
  errorEl.textContent = '';

  const itemId = document.getElementById('edit-item-id').value;
  const isEdit = !!itemId;

  // Use FormData because we might have a file
  const formData = new FormData();
  formData.append('type', document.getElementById('post-type').value);
  formData.append('category', document.getElementById('post-category').value);
  formData.append('title', document.getElementById('post-title').value);
  formData.append('description', document.getElementById('post-desc').value);
  formData.append('location', document.getElementById('post-location').value);
  formData.append('date', document.getElementById('post-date').value);

  const photoFile = document.getElementById('post-photo').files[0];
  if (photoFile) formData.append('photo', photoFile);

  try {
    const url = isEdit ? `/items/${itemId}` : '/items';
    const method = isEdit ? 'PUT' : 'POST';
    const data = await apiCallFormData(url, method, formData);

    closeModal('post-modal');
    showToast(isEdit ? 'Post updated!' : 'Post created! 🎉', 'success');

    // Refresh the relevant page
    loadFeed();
    if (document.getElementById('page-my-posts').classList.contains('active')) {
      loadMyPosts();
    }

  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// ═══════════════════════════════════════════════════════════
//  ITEM DETAIL MODAL
// ═══════════════════════════════════════════════════════════

async function openDetailModal(itemId) {
  openModal('detail-modal');
  document.getElementById('detail-content').innerHTML = `
    <div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
  `;

  try {
    const item = await apiCall(`/items/${itemId}`, 'GET', null, true);
    renderDetailModal(item);
  } catch (err) {
    document.getElementById('detail-content').innerHTML = `<p style="padding:28px;color:var(--lost)">${err.message}</p>`;
  }
}

function renderDetailModal(item) {
  document.getElementById('detail-title').textContent = item.title;

  const isOwner = currentUser && item.postedBy?._id === currentUser.id;
  const dateStr = new Date(item.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const postedStr = new Date(item.createdAt).toLocaleDateString('en-IN');
  const icon = CATEGORY_ICONS[item.category] || '📦';
  const imgSrc = item.photo ? `${API_BASE.replace('/api','')}${item.photo}` : null;
  const isResolved = item.status === 'resolved';

  let actionsHTML = '';
  if (isOwner) {
    // Show owner actions
    actionsHTML = `
      <button class="btn-secondary" onclick="openPostModal(currentDetailItem)">✏️ Edit</button>
      <button class="btn-primary" onclick="openClaimsModal('${item._id}')">📋 View Claims</button>
      ${!isResolved ? `<button class="btn-success" onclick="markResolved('${item._id}')">✓ Mark Resolved</button>` : ''}
      <button class="btn-danger" onclick="deleteItem('${item._id}')">🗑 Delete</button>
    `;
  } else if (!isResolved) {
    // Show claim button for others
    actionsHTML = `
      <button class="btn-primary" onclick="openClaimModal('${item._id}', '${escapeHtml(item.title)}')">
        🙋 This is mine — Claim It
      </button>
    `;
  }

  // Store item globally for edit action
  window.currentDetailItem = item;

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-layout">
      <div>
        ${imgSrc
          ? `<img class="detail-photo" src="${imgSrc}" alt="${escapeHtml(item.title)}" />`
          : `<div class="detail-no-photo">${icon}</div>`
        }
      </div>
      <div class="detail-info">
        <div class="detail-badges">
          <span class="badge badge-${item.type}">${item.type === 'lost' ? '🔴 Lost' : '🟢 Found'}</span>
          <span class="badge badge-category">${item.category}</span>
          ${isResolved ? '<span class="badge badge-resolved">✓ Resolved</span>' : ''}
        </div>
        <div class="detail-title">${escapeHtml(item.title)}</div>
        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <div class="meta-label">📍 Location</div>
            <div class="meta-value">${escapeHtml(item.location)}</div>
          </div>
          <div class="detail-meta-item">
            <div class="meta-label">📅 Date</div>
            <div class="meta-value">${dateStr}</div>
          </div>
          <div class="detail-meta-item">
            <div class="meta-label">👤 Posted By</div>
            <div class="meta-value">${escapeHtml(item.postedBy?.name || 'Unknown')}</div>
          </div>
          <div class="detail-meta-item">
            <div class="meta-label">🏫 College ID</div>
            <div class="meta-value">${escapeHtml(item.postedBy?.collegeId || '-')}</div>
          </div>
        </div>
        <div class="detail-desc">${escapeHtml(item.description)}</div>
        ${item.postedBy?.department ? `<div style="font-size:13px;color:var(--text3)">🎓 ${escapeHtml(item.postedBy.department)}</div>` : ''}
        <div class="detail-actions">${actionsHTML}</div>
      </div>
    </div>
  `;
}

async function markResolved(itemId) {
  if (!confirm('Mark this item as resolved?')) return;
  try {
    await apiCall(`/items/${itemId}/status`, 'PATCH', { status: 'resolved' }, true);
    closeModal('detail-modal');
    showToast('Item marked as resolved!', 'success');
    loadFeed();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
  try {
    await apiCall(`/items/${itemId}`, 'DELETE', null, true);
    closeModal('detail-modal');
    showToast('Post deleted.', 'success');
    loadFeed();
    loadMyPosts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  MY POSTS PAGE
// ═══════════════════════════════════════════════════════════

async function loadMyPosts() {
  const grid = document.getElementById('my-posts-grid');
  const empty = document.getElementById('my-posts-empty');
  grid.innerHTML = '';
  empty.classList.add('hidden');

  try {
    const items = await apiCall('/items/user/mine', 'GET', null, true);

    if (items.length === 0) {
      empty.classList.remove('hidden');
    } else {
      items.forEach(item => grid.appendChild(createItemCard(item)));
    }
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--lost);padding:32px">${err.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════
//  CLAIMS
// ═══════════════════════════════════════════════════════════

function openClaimModal(itemId, itemTitle) {
  document.getElementById('claim-item-id').value = itemId;
  document.getElementById('claim-item-title').textContent = itemTitle;
  document.getElementById('claim-form').reset();
  document.getElementById('claim-error').textContent = '';

  // Pre-fill contact with user's email
  if (currentUser?.email) {
    document.getElementById('claim-contact').value = currentUser.email;
  }

  closeModal('detail-modal');
  openModal('claim-modal');
}

async function handleSubmitClaim(e) {
  e.preventDefault();
  const errorEl = document.getElementById('claim-error');
  errorEl.textContent = '';

  const payload = {
    itemId: document.getElementById('claim-item-id').value,
    message: document.getElementById('claim-message').value,
    contactInfo: document.getElementById('claim-contact').value
  };

  try {
    await apiCall('/claims', 'POST', payload, true);
    closeModal('claim-modal');
    showToast('Claim submitted! The poster will review your request.', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function openClaimsModal(itemId) {
  openModal('claims-modal');
  document.getElementById('claims-list-content').innerHTML = `
    <div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>
  `;

  try {
    const claims = await apiCall(`/claims/item/${itemId}`, 'GET', null, true);

    if (claims.length === 0) {
      document.getElementById('claims-list-content').innerHTML =
        '<p style="padding:28px;color:var(--text2)">No claim requests yet.</p>';
      return;
    }

    document.getElementById('claims-list-content').innerHTML =
      `<p style="padding:16px 28px;font-size:14px;color:var(--text2)">${claims.length} claim request(s)</p>` +
      claims.map(claim => `
        <div class="claim-item">
          <div class="claim-item-header">
            <div>
              <div class="claim-user">
                ${escapeHtml(claim.claimedBy?.name || 'Unknown')}
                <small> · ${escapeHtml(claim.claimedBy?.collegeId || '')}</small>
              </div>
              <div style="font-size:12px;color:var(--text3)">${timeAgo(claim.createdAt)}</div>
            </div>
            <span class="claim-status status-${claim.status}">${claim.status}</span>
          </div>
          <div class="claim-message">"${escapeHtml(claim.message)}"</div>
          <div class="claim-contact">📞 ${escapeHtml(claim.contactInfo)}</div>
          ${claim.status === 'pending' ? `
            <div class="claim-actions">
              <button class="btn-success" onclick="respondToClaim('${claim._id}', 'approved')">✓ Approve</button>
              <button class="btn-danger" onclick="respondToClaim('${claim._id}', 'rejected')">✕ Reject</button>
            </div>
          ` : ''}
        </div>
      `).join('');

  } catch (err) {
    document.getElementById('claims-list-content').innerHTML =
      `<p style="padding:28px;color:var(--lost)">${err.message}</p>`;
  }
}

async function respondToClaim(claimId, status) {
  try {
    await apiCall(`/claims/${claimId}`, 'PATCH', { status }, true);
    showToast(`Claim ${status}!`, status === 'approved' ? 'success' : 'error');
    closeModal('claims-modal');
    loadFeed();
    loadMyPosts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMyClaims() {
  const list = document.getElementById('my-claims-list');
  const empty = document.getElementById('my-claims-empty');
  list.innerHTML = '';
  empty.classList.add('hidden');

  try {
    const claims = await apiCall('/claims/mine', 'GET', null, true);

    if (claims.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    claims.forEach(claim => {
      const item = claim.item || {};
      const div = document.createElement('div');
      div.className = 'claim-card';
      const imgSrc = item.photo ? `${API_BASE.replace('/api','')}${item.photo}` : null;
      const icon = CATEGORY_ICONS[item.category] || '📦';

      div.innerHTML = `
        ${imgSrc
          ? `<img class="claim-card-photo" src="${imgSrc}" alt="${escapeHtml(item.title || '')}" />`
          : `<div class="claim-card-photo" style="display:flex;align-items:center;justify-content:center;font-size:32px;border-radius:8px;background:var(--bg3)">${icon}</div>`
        }
        <div>
          <h4>${escapeHtml(item.title || 'Item removed')}</h4>
          <p style="font-size:13px;color:var(--text2);margin:4px 0 8px">${item.type ? `${item.type.charAt(0).toUpperCase()+item.type.slice(1)} · ${item.location || ''}` : ''}</p>
          <p style="font-size:13px;color:var(--text3)">"${escapeHtml(claim.message)}"</p>
          ${claim.responseNote ? `<p style="font-size:13px;color:var(--accent);margin-top:6px">Response: "${escapeHtml(claim.responseNote)}"</p>` : ''}
          <p style="font-size:12px;color:var(--text3);margin-top:6px">${timeAgo(claim.createdAt)}</p>
        </div>
        <span class="claim-status status-${claim.status}">${claim.status}</span>
      `;
      list.appendChild(div);
    });

  } catch (err) {
    list.innerHTML = `<p style="color:var(--lost);padding:32px">${err.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════
//  PUBLIC STATS (Auth screen)
// ═══════════════════════════════════════════════════════════

async function loadPublicStats() {
  try {
    const data = await apiCall('/items?limit=1', 'GET', null, false);
    document.getElementById('stat-total').textContent = data.totalItems || 0;

    // Count resolved items
    const resolved = await apiCall('/items?limit=1&status=resolved', 'GET', null, false);
    // We'll approximate with a search for all items
    document.getElementById('stat-resolved').textContent = '—';
  } catch (err) {
    // Silently fail — stats are cosmetic
  }
}

// ═══════════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// ═══════════════════════════════════════════════════════════
//  API CALL HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Make a JSON API call
 * @param {string} endpoint - API endpoint (e.g. '/items')
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} body - Request body (for POST/PUT)
 * @param {boolean} requiresAuth - Whether to include JWT token
 */
async function apiCall(endpoint, method, body, requiresAuth) {
  const headers = { 'Content-Type': 'application/json' };
  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

/**
 * Make a FormData API call (for file uploads)
 */
async function apiCallFormData(endpoint, method, formData) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: formData
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ═══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Escape HTML to prevent XSS attacks
 * Always use this when inserting user-provided text into HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert a date to "X minutes ago" format
 */
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}
