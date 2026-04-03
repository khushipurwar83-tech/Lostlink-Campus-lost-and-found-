// ============================================================
// app.js — All frontend logic for Campus Lost & Found
// This file handles: auth, fetching items, posting, claims, etc.
// ✅ FULLY LOCAL — No backend needed. Uses localStorage only.
// ============================================================

// ── State: Things we remember while the app is running ────
let currentUser = null;   // Logged-in user info
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

// ── localStorage Keys ──────────────────────────────────────
const STORAGE_KEYS = {
  users:   'lnf_users',    // Array of registered users
  items:   'lnf_items',    // Array of posted items
  claims:  'lnf_claims',   // Array of submitted claims
  token:   'lnf_token',    // Logged-in user's ID (acts as token)
  user:    'lnf_user',     // Logged-in user's info object
};

// ── localStorage Helpers ───────────────────────────────────

function getUsers()  { return JSON.parse(localStorage.getItem(STORAGE_KEYS.users)  || '[]'); }
function getItems()  { return JSON.parse(localStorage.getItem(STORAGE_KEYS.items)  || '[]'); }
function getClaims() { return JSON.parse(localStorage.getItem(STORAGE_KEYS.claims) || '[]'); }

function saveUsers(users)   { localStorage.setItem(STORAGE_KEYS.users,  JSON.stringify(users));  }
function saveItems(items)   { localStorage.setItem(STORAGE_KEYS.items,  JSON.stringify(items));  }
function saveClaims(claims) { localStorage.setItem(STORAGE_KEYS.claims, JSON.stringify(claims)); }

// Generate a simple unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ═══════════════════════════════════════════════════════════
//  INITIALIZATION — Runs when page loads
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  const savedUser = localStorage.getItem(STORAGE_KEYS.user);
  const savedToken = localStorage.getItem(STORAGE_KEYS.token);

  if (savedToken && savedUser) {
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

function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const collegeId = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-pass').value;

  // Find user in localStorage
  const users = getUsers();
  const user = users.find(u => u.collegeId === collegeId && u.password === password);

  if (!user) {
    errorEl.textContent = 'Invalid College ID or password.';
    return;
  }

  saveAuth(user);
  showApp();
}

function handleRegister(e) {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';

  const newUser = {
    id: generateId(),
    collegeId: document.getElementById('reg-id').value.trim(),
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-pass').value,
    department: document.getElementById('reg-dept').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    createdAt: new Date().toISOString()
  };

  // Check if College ID already exists
  const users = getUsers();
  if (users.find(u => u.collegeId === newUser.collegeId)) {
    errorEl.textContent = 'This College ID is already registered.';
    return;
  }

  // Save new user
  users.push(newUser);
  saveUsers(users);

  saveAuth(newUser);
  showApp();
  showToast('Welcome! Account created successfully 🎉', 'success');
}

function saveAuth(user) {
  // Don't store the password in the active session object
  const sessionUser = { ...user };
  delete sessionUser.password;

  currentUser = sessionUser;
  localStorage.setItem(STORAGE_KEYS.token, user.id);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(sessionUser));
}

function logout() {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
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

function loadFeed(page = 1) {
  currentPage = page;
  const grid = document.getElementById('items-grid');
  const loading = document.getElementById('feed-loading');
  const empty = document.getElementById('feed-empty');
  const resultsCount = document.getElementById('results-count');

  // Show loading, hide others
  grid.innerHTML = '';
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  // Read filters
  const filterType     = document.getElementById('filter-type').value;
  const filterCategory = document.getElementById('filter-category').value;
  const filterLocation = document.getElementById('filter-location').value.toLowerCase();
  const filterDateFrom = document.getElementById('filter-date-from').value;
  const filterDateTo   = document.getElementById('filter-date-to').value;
  const searchQuery    = document.getElementById('search-input').value.toLowerCase();

  // Get all items and apply filters
  let items = getItems();

  if (filterType)     items = items.filter(i => i.type === filterType);
  if (filterCategory) items = items.filter(i => i.category === filterCategory);
  if (filterLocation) items = items.filter(i => i.location.toLowerCase().includes(filterLocation));
  if (filterDateFrom) items = items.filter(i => i.date >= filterDateFrom);
  if (filterDateTo)   items = items.filter(i => i.date <= filterDateTo);
  if (searchQuery)    items = items.filter(i =>
    i.title.toLowerCase().includes(searchQuery) ||
    i.description.toLowerCase().includes(searchQuery) ||
    i.location.toLowerCase().includes(searchQuery)
  );

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Paginate
  const LIMIT = 12;
  const totalItems = items.length;
  totalPages = Math.ceil(totalItems / LIMIT) || 1;
  const paginated = items.slice((page - 1) * LIMIT, page * LIMIT);

  loading.classList.add('hidden');

  if (paginated.length === 0) {
    empty.classList.remove('hidden');
    resultsCount.textContent = '0 results';
  } else {
    resultsCount.textContent = `${totalItems} result${totalItems !== 1 ? 's' : ''}`;
    paginated.forEach(item => grid.appendChild(createItemCard(item)));
    renderPagination(page, totalPages);
  }
}

function createItemCard(item) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.onclick = () => openDetailModal(item.id);

  const icon = CATEGORY_ICONS[item.category] || '📦';
  const dateStr = new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const postedAgo = timeAgo(item.createdAt);
  const isResolved = item.status === 'resolved';

  card.innerHTML = `
    ${item.photo
      ? `<img class="card-photo" src="${item.photo}" alt="${escapeHtml(item.title)}" loading="lazy"/>`
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
    document.getElementById('edit-item-id').value = itemData.id;
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

function handlePostItem(e) {
  e.preventDefault();
  const errorEl = document.getElementById('post-error');
  errorEl.textContent = '';

  const itemId = document.getElementById('edit-item-id').value;
  const isEdit = !!itemId;

  const photoFile = document.getElementById('post-photo').files[0];

  // If there's a new photo, read it as base64; otherwise proceed without
  if (photoFile) {
    const reader = new FileReader();
    reader.onload = (e) => saveItem(itemId, isEdit, e.target.result, errorEl);
    reader.readAsDataURL(photoFile);
  } else {
    saveItem(itemId, isEdit, null, errorEl);
  }
}

function saveItem(itemId, isEdit, photoBase64, errorEl) {
  const items = getItems();

  if (isEdit) {
    // Update existing item
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) { errorEl.textContent = 'Item not found.'; return; }

    items[index].type        = document.getElementById('post-type').value;
    items[index].category    = document.getElementById('post-category').value;
    items[index].title       = document.getElementById('post-title').value.trim();
    items[index].description = document.getElementById('post-desc').value.trim();
    items[index].location    = document.getElementById('post-location').value.trim();
    items[index].date        = document.getElementById('post-date').value;
    if (photoBase64) items[index].photo = photoBase64;

    saveItems(items);
    closeModal('post-modal');
    showToast('Post updated!', 'success');

  } else {
    // Create new item
    const newItem = {
      id: generateId(),
      type:        document.getElementById('post-type').value,
      category:    document.getElementById('post-category').value,
      title:       document.getElementById('post-title').value.trim(),
      description: document.getElementById('post-desc').value.trim(),
      location:    document.getElementById('post-location').value.trim(),
      date:        document.getElementById('post-date').value,
      photo:       photoBase64 || null,
      status:      'active',
      postedBy: {
        id:         currentUser.id,
        name:       currentUser.name,
        collegeId:  currentUser.collegeId,
        department: currentUser.department || ''
      },
      createdAt: new Date().toISOString()
    };

    items.push(newItem);
    saveItems(items);
    closeModal('post-modal');
    showToast('Post created! 🎉', 'success');
  }

  // Refresh the relevant page
  loadFeed();
  if (document.getElementById('page-my-posts').classList.contains('active')) {
    loadMyPosts();
  }
}

// ═══════════════════════════════════════════════════════════
//  ITEM DETAIL MODAL
// ═══════════════════════════════════════════════════════════

function openDetailModal(itemId) {
  openModal('detail-modal');

  const items = getItems();
  const item = items.find(i => i.id === itemId);

  if (!item) {
    document.getElementById('detail-content').innerHTML =
      '<p style="padding:28px;color:var(--lost)">Item not found.</p>';
    return;
  }

  renderDetailModal(item);
}

function renderDetailModal(item) {
  document.getElementById('detail-title').textContent = item.title;

  const isOwner = currentUser && item.postedBy?.id === currentUser.id;
  const dateStr = new Date(item.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const icon = CATEGORY_ICONS[item.category] || '📦';
  const isResolved = item.status === 'resolved';

  let actionsHTML = '';
  if (isOwner) {
    // Show owner actions
    actionsHTML = `
      <button class="btn-secondary" onclick="openPostModal(currentDetailItem)">✏️ Edit</button>
      <button class="btn-primary" onclick="openClaimsModal('${item.id}')">📋 View Claims</button>
      ${!isResolved ? `<button class="btn-success" onclick="markResolved('${item.id}')">✓ Mark Resolved</button>` : ''}
      <button class="btn-danger" onclick="deleteItem('${item.id}')">🗑 Delete</button>
    `;
  } else if (!isResolved) {
    // Show claim button for others
    actionsHTML = `
      <button class="btn-primary" onclick="openClaimModal('${item.id}', '${escapeHtml(item.title)}')">
        🙋 This is mine — Claim It
      </button>
    `;
  }

  // Store item globally for edit action
  window.currentDetailItem = item;

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-layout">
      <div>
        ${item.photo
          ? `<img class="detail-photo" src="${item.photo}" alt="${escapeHtml(item.title)}" />`
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

function markResolved(itemId) {
  if (!confirm('Mark this item as resolved?')) return;

  const items = getItems();
  const index = items.findIndex(i => i.id === itemId);
  if (index === -1) { showToast('Item not found.', 'error'); return; }

  items[index].status = 'resolved';
  saveItems(items);

  closeModal('detail-modal');
  showToast('Item marked as resolved!', 'success');
  loadFeed();
}

function deleteItem(itemId) {
  if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;

  const items = getItems().filter(i => i.id !== itemId);
  saveItems(items);

  // Also delete related claims
  const claims = getClaims().filter(c => c.itemId !== itemId);
  saveClaims(claims);

  closeModal('detail-modal');
  showToast('Post deleted.', 'success');
  loadFeed();
  loadMyPosts();
}

// ═══════════════════════════════════════════════════════════
//  MY POSTS PAGE
// ═══════════════════════════════════════════════════════════

function loadMyPosts() {
  const grid = document.getElementById('my-posts-grid');
  const empty = document.getElementById('my-posts-empty');
  grid.innerHTML = '';
  empty.classList.add('hidden');

  const items = getItems().filter(i => i.postedBy?.id === currentUser.id);

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (items.length === 0) {
    empty.classList.remove('hidden');
  } else {
    items.forEach(item => grid.appendChild(createItemCard(item)));
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

function handleSubmitClaim(e) {
  e.preventDefault();
  const errorEl = document.getElementById('claim-error');
  errorEl.textContent = '';

  const itemId = document.getElementById('claim-item-id').value;

  // Prevent duplicate claims by same user on same item
  const existing = getClaims().find(c => c.itemId === itemId && c.claimedById === currentUser.id);
  if (existing) {
    errorEl.textContent = 'You have already submitted a claim for this item.';
    return;
  }

  const newClaim = {
    id: generateId(),
    itemId,
    message:     document.getElementById('claim-message').value.trim(),
    contactInfo: document.getElementById('claim-contact').value.trim(),
    status:      'pending',
    claimedById: currentUser.id,
    claimedBy: {
      name:      currentUser.name,
      collegeId: currentUser.collegeId
    },
    createdAt: new Date().toISOString()
  };

  const claims = getClaims();
  claims.push(newClaim);
  saveClaims(claims);

  closeModal('claim-modal');
  showToast('Claim submitted! The poster will review your request.', 'success');
}

function openClaimsModal(itemId) {
  openModal('claims-modal');

  const claims = getClaims().filter(c => c.itemId === itemId);

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
            <button class="btn-success" onclick="respondToClaim('${claim.id}', 'approved')">✓ Approve</button>
            <button class="btn-danger" onclick="respondToClaim('${claim.id}', 'rejected')">✕ Reject</button>
          </div>
        ` : ''}
      </div>
    `).join('');
}

function respondToClaim(claimId, status) {
  const claims = getClaims();
  const index = claims.findIndex(c => c.id === claimId);
  if (index === -1) { showToast('Claim not found.', 'error'); return; }

  claims[index].status = status;
  saveClaims(claims);

  showToast(`Claim ${status}!`, status === 'approved' ? 'success' : 'error');
  closeModal('claims-modal');
  loadFeed();
  loadMyPosts();
}

function loadMyClaims() {
  const list = document.getElementById('my-claims-list');
  const empty = document.getElementById('my-claims-empty');
  list.innerHTML = '';
  empty.classList.add('hidden');

  // Get all claims made by the current user
  const myClaims = getClaims().filter(c => c.claimedById === currentUser.id);

  // Sort newest first
  myClaims.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (myClaims.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  const allItems = getItems();

  myClaims.forEach(claim => {
    const item = allItems.find(i => i.id === claim.itemId) || {};
    const div = document.createElement('div');
    div.className = 'claim-card';
    const icon = CATEGORY_ICONS[item.category] || '📦';

    div.innerHTML = `
      ${item.photo
        ? `<img class="claim-card-photo" src="${item.photo}" alt="${escapeHtml(item.title || '')}" />`
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
}

// ═══════════════════════════════════════════════════════════
//  PUBLIC STATS (Auth screen)
// ═══════════════════════════════════════════════════════════

function loadPublicStats() {
  const items = getItems();
  const resolved = items.filter(i => i.status === 'resolved').length;

  const statTotal = document.getElementById('stat-total');
  const statResolved = document.getElementById('stat-resolved');

  if (statTotal)    statTotal.textContent    = items.length;
  if (statResolved) statResolved.textContent = resolved;
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
