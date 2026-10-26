const API = '/api';
let token = localStorage.getItem('adminToken') || '';

function authHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${token}` };
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', login);
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(t.dataset.pane).classList.add('active');
    });
  });

  if (token) showDashboard();
});

async function login() {
  const username = document.getElementById('adminUser').value;
  const password = document.getElementById('adminPass').value;
  const status = document.getElementById('loginStatus');
  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    token = data.token;
    localStorage.setItem('adminToken', token);
    showDashboard();
  } catch (e) {
    status.textContent = e.message;
  }
}

function showDashboard() {
  document.getElementById('loginPane').classList.remove('active');
  document.getElementById('dashPane').classList.add('active');
  loadBookings();
  loadMethods();
  loadPortfolio();
  wireUpload();
}

// ---------- Bookings ----------
async function loadBookings() {
  const res = await fetch(`${API}/admin/bookings`, { headers: authHeaders() });
  const bookings = await res.json();
  const tbody = document.getElementById('bookingsBody');
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted center">No bookings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td>#${b.id}</td>
      <td>${b.customer_name}<br><span class="muted small">${b.customer_email}</span></td>
      <td>${b.service_name}</td>
      <td>${new Date(b.scheduled_at).toLocaleString()}</td>
      <td>$${Number(b.amount).toFixed(2)}</td>
      <td>${b.payment_method || '—'}</td>
      <td>${b.payment_ref || '—'}</td>
      <td><span class="badge ${b.payment_status}">${b.payment_status}</span></td>
      <td>
        ${b.payment_status !== 'confirmed' ? `<button class="btn" style="padding:6px 12px;font-size:13px;" onclick="confirmBooking(${b.id})">Confirm</button>` : ''}
        ${b.payment_status !== 'cancelled' ? `<button class="btn" style="padding:6px 12px;font-size:13px;background:#dc2626;" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function confirmBooking(id) {
  if (!confirm(`Confirm booking #${id}? Customer and owner will be emailed.`)) return;
  const res = await fetch(`${API}/admin/bookings/${id}/confirm`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!res.ok) { alert('Confirm failed'); return; }
  await loadBookings();
}

async function cancelBooking(id) {
  if (!confirm(`Cancel booking #${id}?`)) return;
  const res = await fetch(`${API}/admin/bookings/${id}/cancel`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!res.ok) { alert('Cancel failed'); return; }
  await loadBookings();
}

// ---------- Payment methods ----------
async function loadMethods() {
  const res = await fetch(`${API}/admin/payment-methods`, { headers: authHeaders() });
  const methods = await res.json();
  const box = document.getElementById('methodsBody');
  box.innerHTML = methods.map(m => `
    <div class="payment-option" style="cursor:default;">
      <div class="row" style="justify-content:space-between;">
        <strong>${m.label}</strong>
        <label class="row" style="gap:6px;">
          <input type="checkbox" ${m.enabled ? 'checked' : ''}
                 onchange="toggleMethod('${m.code}', this.checked)" />
          Enabled
        </label>
      </div>
      <div class="row" style="margin-top:8px;">
        <input type="text" placeholder="Till / number / paybill"
               value="${m.account || ''}"
               onblur="saveMethod('${m.code}', { account: this.value })" style="flex:1;" />
      </div>
      <textarea rows="2" placeholder="Instructions shown to client"
                onblur="saveMethod('${m.code}', { instructions: this.value })"
                style="width:100%; margin-top:6px;">${m.instructions || ''}</textarea>
    </div>
  `).join('');
}

async function toggleMethod(code, enabled) {
  await fetch(`${API}/admin/payment-methods/${code}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled }),
  });
  await loadMethods();
}

async function saveMethod(code, patch) {
  await fetch(`${API}/admin/payment-methods/${code}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
}

// ---------- Portfolio ----------
async function loadPortfolio() {
  const res = await fetch(`${API}/portfolio`);
  const items = await res.json();
  const grid = document.getElementById('portfolioAdmin');
  if (!items.length) { grid.innerHTML = '<p class="muted center">No items yet.</p>'; return; }
  grid.innerHTML = items.map(i => `
    <div class="card">
      <img src="${i.image_url}" alt="${i.title}" />
      <h3>${i.title}</h3>
      <button class="btn" style="background:#dc2626;padding:6px 12px;font-size:13px;margin-top:8px;"
              onclick="deletePortfolio(${i.id})">Delete</button>
    </div>
  `).join('');
}

async function deletePortfolio(id) {
  if (!confirm('Delete this item?')) return;
  await fetch(`${API}/admin/portfolio/${id}`, { method: 'DELETE', headers: authHeaders() });
  await loadPortfolio();
}

// ---------- Upload ----------
function wireUpload() {
  const form = document.getElementById('uploadForm');
  const status = document.getElementById('uploadStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Uploading…';
    const fd = new FormData(form);
    const res = await fetch(`${API}/admin/portfolio`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    });
    if (!res.ok) {
      status.textContent = 'Upload failed';
      return;
    }
    status.textContent = '✅ Uploaded!';
    form.reset();
    await loadPortfolio();
  });
}
