const API = '/api';
let currentBooking = null;
let currentMethod = null;

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  await Promise.all([loadServices(), loadPortfolio(), loadPaymentMethods()]);
  wireBookingForm();
  wireMpesaStep();
  wireContactForm();
});

// ---------- Services ----------
async function loadServices() {
  const res = await fetch(`${API}/services`);
  const services = await res.json();
  const grid = document.getElementById('servicesGrid');
  const select = document.getElementById('serviceSelect');
  grid.innerHTML = '';
  select.innerHTML = '<option value="">— Choose a service —</option>';

  services.forEach(s => {
    grid.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3>${s.name}</h3>
        <p>${s.description || ''}</p>
        <div class="price">$${Number(s.base_price).toFixed(2)} <span class="muted">${s.unit || ''}</span></div>
      </div>
    `);
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.name} — $${Number(s.base_price).toFixed(2)}`;
    select.appendChild(opt);
  });
}

// ---------- Portfolio ----------
async function loadPortfolio() {
  const res = await fetch(`${API}/portfolio`);
  const items = await res.json();
  const grid = document.getElementById('portfolioGrid');
  if (!items.length) {
    grid.innerHTML = '<p class="muted center">Portfolio coming soon.</p>';
    return;
  }
  grid.innerHTML = items.map(i => `
    <div class="card">
      <img src="${i.image_url}" alt="${i.title}" loading="lazy" />
      <h3>${i.title}</h3>
      ${i.description ? `<p>${i.description}</p>` : ''}
    </div>
  `).join('');
}

// ---------- Payment methods ----------
async function loadPaymentMethods() {
  const res = await fetch(`${API}/config/payment-methods`);
  const methods = await res.json();
  const box = document.getElementById('paymentMethods');

  if (!methods.length) {
    box.innerHTML = '<p class="muted">No payment method is currently available. Please contact us.</p>';
    document.getElementById('createBookingBtn').disabled = true;
    return;
  }

  box.innerHTML = methods.map(m => `
    <label class="payment-option">
      <input type="radio" name="paymentMethod" value="${m.code}" required />
      <strong>${m.label}</strong>
      <span class="muted small">${m.instructions}</span>
    </label>
  `).join('');
}

// ---------- Booking ----------
function wireBookingForm() {
  const form = document.getElementById('bookingForm');
  const btn = document.getElementById('createBookingBtn');
  const status = document.getElementById('status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Creating booking…';
    btn.disabled = true;

    const fd = new FormData(form);
    const payload = {
      serviceId: Number(fd.get('serviceId')),
      customerName: fd.get('customerName'),
      customerEmail: fd.get('customerEmail'),
      customerPhone: fd.get('customerPhone'),
      address: fd.get('address'),
      scheduledAt: fd.get('scheduledAt'),
      notes: fd.get('notes'),
      paymentMethod: fd.get('paymentMethod'),
    };

    try {
      const res = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');

      currentBooking = data;
      currentMethod = payload.paymentMethod;

      // show M-Pesa step
      document.getElementById('bookingForm').classList.add('hidden');
      document.getElementById('mpesaStep').classList.remove('hidden');

      // Fetch instructions for the selected method
      const methods = await (await fetch(`${API}/config/payment-methods`)).json();
      const m = methods.find(x => x.code === currentMethod);
      document.getElementById('mpesaInstructions').innerHTML = `
        <p><strong>${m.label}</strong></p>
        <p>${m.instructions}</p>
        ${m.account ? `<p><strong>Account / Number / Till:</strong> ${m.account}</p>` : ''}
        <p><strong>Amount:</strong> $${Number(data.amount).toFixed(2)}</p>
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
      `;
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false;
    }
  });
}

function wireMpesaStep() {
  const btn = document.getElementById('submitRefBtn');
  const status = document.getElementById('mpesaStatus');

  btn.addEventListener('click', async () => {
    const ref = document.getElementById('mpesaRef').value.trim();
    if (!ref) { status.textContent = 'Enter your M-Pesa code.'; return; }

    status.textContent = 'Submitting…';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/bookings/${currentBooking.bookingId}/submit-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRef: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');

      status.textContent = '✅ Payment reference received! We will confirm your booking shortly.';
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false;
    }
  });
}

// ---------- Contact ----------
function wireContactForm() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      message: fd.get('message'),
    };
    status.textContent = 'Sending…';
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      status.textContent = '✅ Message sent!';
      form.reset();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}
