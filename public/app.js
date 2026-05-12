// public/app.js

// ===== API helpers =====
function getToken() {
  const t = sessionStorage.getItem('authToken');
  if (!t) {
    location.replace('/login.html');
    throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  }
  return t;
}

const tokenHdr = () => ({ Authorization: 'Bearer ' + getToken() });

async function apiFetch(path, { method = 'GET', json, headers } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Accept': 'application/json',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      'Authorization': 'Bearer ' + getToken(),
      ...(headers || {})
    },
    body: json ? JSON.stringify(json) : undefined
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json() : await res.text();

  if (res.status === 401 || res.status === 403) {
    location.replace('/login.html?reason=expired');
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : (body && body.message) || res.statusText;
    throw new Error(msg || 'Request failed');
  }
  return body;
}

async function apiList(path) {
  const body = await apiFetch(path);
  return Array.isArray(body) ? body : (body && body.data) ? body.data : [];
}

// ===== UI refs =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const listEl = document.getElementById('booking-list');
const emptyEl = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');

// ===== Safe helpers =====
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtMoney = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ===== Settings (Load once) =====
let APP_SETTINGS = null;
async function loadSettings() {
  try {
    APP_SETTINGS = await apiFetch('/api/settings');
  } catch { APP_SETTINGS = {}; }
}

// ===== Render helpers =====
function fmtDate(d) {
  const x = new Date(d); if (isNaN(x)) return '-';
  return x.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: '2-digit' });
}

function rowCard(b) {
  const id = b._id || b.id;
  const cust = esc(b.customer || '-');
  const type = esc(b.bookingType || '');
  const phone = esc(b.contactPhone || '-');

  const statusClass =
    b.status === 'Confirmed' ? 'chip chip-confirmed' :
    b.status === 'Cancelled' ? 'chip chip-cancelled' :
    'chip chip-pending';

  return `
  <div class="col-12 col-md-6 col-xl-4">
    <div class="p-3 border rounded-3 bg-white booking-card h-100">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${cust}</div>
          <div class="muted small">${type}</div>
        </div>
        <span class="${statusClass}">${esc(b.status || 'Pending')}</span>
      </div>
      <div class="mt-3 small muted">
        วันที่: ${fmtDate(b.date)}<br/>
        เวลา: ${esc(b.startTime || '-')} – ${esc(b.endTime || '-')}<br/>
        โทร: ${phone}
      </div>
      <div class="mt-3 d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${id}">แก้ไข</button>
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${id}">ลบ</button>
        <button class="btn btn-sm btn-dark" data-action="make-quote" data-id="${id}">
          ใบเสนอราคา
        </button>
        <a href="/tasks.html?bookingId=${id}" class="btn btn-sm btn-outline-secondary">
          👷 จ่ายงาน
        </a>
      </div>
    </div>
  </div>`;
}

function renderList(rows) {
  if (!rows.length) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }
  emptyEl.classList.add('d-none');
  listEl.innerHTML = rows.map(rowCard).join('');
}

// ===== Load & filter =====
let allRows = [];
async function loadBookings() {
  try {
    const rows = await apiList('/api/bookings');
    allRows = rows;
    applyFilter();
  } catch (e) {
    console.error(e);
    window.showToast?.('โหลดรายการล้มเหลว: ' + (e.message || e), true);
    renderList([]);
  }
}

function applyFilter() {
  const q = (searchInput?.value || '').toLowerCase().trim();
  const st = statusFilter?.value || '';
  const filtered = allRows.filter(r => {
    const hitQ = !q || [r.customer, r.bookingType, r.contactPhone]
      .some(x => (String(x || '')).toLowerCase().includes(q));
    const hitSt = !st || r.status === st;
    return hitQ && hitSt;
  });
  renderList(filtered);
}

// ===== Create booking =====
const addForm = document.getElementById('add-booking-form');
addForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(addForm);
  const json = Object.fromEntries(fd.entries());
  try {
    await apiFetch('/api/bookings', { method: 'POST', json });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addBookingModal')).hide();
    window.showToast?.('เพิ่มการจองแล้ว');
    await loadBookings();
    addForm.reset();
  } catch (err) {
    window.showToast?.('บันทึกไม่สำเร็จ: ' + (err.message || err), true);
  }
});

// ===== Edit/Delete/Quote (delegation) =====
document.addEventListener('click', async (e) => {
  const t = e.target;

  // ลบ
  const btnDel = t.closest('.btn-delete');
  if (btnDel) {
    const id = btnDel.dataset.id;
    if (!confirm('ลบรายการนี้?')) return;
    try {
      await apiFetch('/api/bookings/' + id, { method: 'DELETE' });
      window.showToast?.('ลบสำเร็จ');
      await loadBookings();
    } catch (err) {
      window.showToast?.('ลบไม่สำเร็จ: ' + (err.message || err), true);
    }
    return;
  }

  // แก้ไข
  const btnEdit = t.closest('.btn-edit');
  if (btnEdit) {
    const id = btnEdit.dataset.id;
    try {
      const item = await apiFetch('/api/bookings/' + id);
      document.getElementById('edit-id').value = item._id || item.id;
      document.getElementById('edit-customer').value = item.customer || '';
      document.getElementById('edit-date').value = item.date ? new Date(item.date).toISOString().slice(0, 10) : '';
      document.getElementById('edit-startTime').value = item.startTime || '';
      document.getElementById('edit-endTime').value = item.endTime || '';
      document.getElementById('edit-bookingType').value = item.bookingType || 'อื่นๆ';
      document.getElementById('edit-contactPhone').value = item.contactPhone || '';
      document.getElementById('edit-customerType').value = item.customerType || 'บุคคลทั่วไป';
      document.getElementById('edit-details').value = item.details || '';
      bootstrap.Modal.getOrCreateInstance(document.getElementById('editBookingModal')).show();
    } catch (err) {
      window.showToast?.('โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err), true);
    }
    return;
  }

  // ใบเสนอราคา: เปิด modal
  const btnQuote = t.closest('[data-action="make-quote"]');
  if (btnQuote) {
    const id = btnQuote.dataset.id;
    try {
      const booking = await apiFetch('/api/bookings/' + encodeURIComponent(id));
      openQuoteModal(booking);
    } catch (err) {
      window.showToast?.('โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err), true);
    }
    return;
  }
});

// ===== Save edit =====
const editForm = document.getElementById('edit-booking-form');
editForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    customer: document.getElementById('edit-customer').value.trim(),
    date: document.getElementById('edit-date').value,
    startTime: document.getElementById('edit-startTime').value,
    endTime: document.getElementById('edit-endTime').value,
    bookingType: document.getElementById('edit-bookingType').value,
    contactPhone: document.getElementById('edit-contactPhone').value,
    customerType: document.getElementById('edit-customerType').value,
    details: document.getElementById('edit-details').value
  };
  try {
    await apiFetch('/api/bookings/' + id, { method: 'PUT', json: payload });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editBookingModal')).hide();
    window.showToast?.('บันทึกแล้ว');
    await loadBookings();
  } catch (err) {
    window.showToast?.('บันทึกไม่สำเร็จ: ' + (err.message || err), true);
  }
});

/* ========= ส่วนของ Modal “สร้างใบเสนอราคา” ========= */
function addItemRow(container, data = {}) {
  const row = document.createElement('div');
  row.className = 'row g-2 align-items-end mb-2';
  row.innerHTML = `
    <div class="col-md-6">
      <input class="form-control q-desc" placeholder="รายละเอียด" value="${esc(data.description || '')}">
    </div>
    <div class="col-md-2">
      <label class="form-label small mb-1 d-block">จำนวน</label>
      <input class="form-control q-qty" type="number" min="0" value="${Number(data.quantity ?? 1)}">
    </div>
    <div class="col-md-3">
      <label class="form-label small mb-1 d-block">ราคาต่อหน่วย</label>
      <input class="form-control q-price" type="number" min="0" step="0.01" value="${Number(data.price ?? 0)}">
    </div>
    <div class="col-md-1 text-end">
      <button type="button" class="btn btn-outline-danger btn-sm q-del">ลบ</button>
    </div>
  `;
  container.appendChild(row);
  row.querySelector('.q-del').onclick = () => { row.remove(); recalcQuote(); };
  row.querySelectorAll('input').forEach(i => i.addEventListener('input', recalcQuote));
}

function recalcQuote() {
  const rows = $$('#q-items .row');
  let sub = 0;
  rows.forEach(r => {
    const qty = Math.max(0, Number(r.querySelector('.q-qty')?.value || 0));
    const price = Math.max(0, Number(r.querySelector('.q-price')?.value || 0));
    sub += qty * price;
  });
  const disc = Math.max(0, Number($('#q-discount')?.value || 0));
  $('#q-subtotal').textContent = fmtMoney(sub);
  $('#q-discount-val').textContent = fmtMoney(disc);
  $('#q-grand').textContent = fmtMoney(Math.max(sub - disc, 0));
}

async function openQuoteModal(booking) {
  if (!APP_SETTINGS) await loadSettings();
  const defaultTerm = Number(APP_SETTINGS?.doc?.creditTermDays ?? 30);

  $('#q-bookingId').value = booking?._id || booking?.id || '';
  $('#q-customerName').value = booking?.customer || '';
  $('#q-contactName').value = '';
  $('#q-customerTaxId').value = '';
  $('#q-customerAddress').value = '';
  $('#q-projectName').value = booking?.bookingType || '';
  $('#q-referenceNumber').value = '';
  $('#q-creditTerm').value = defaultTerm;
  $('#q-discount').value = 0;

  const box = $('#q-items');
  box.innerHTML = '';
  addItemRow(box, { description: booking?.bookingType || '', quantity: 1, price: 0 });

  $('#q-add-item').onclick = () => addItemRow(box);
  $('#q-discount').oninput = recalcQuote;

  recalcQuote();
  bootstrap.Modal.getOrCreateInstance($('#quote-modal')).show();

  $('#quote-form').onsubmit = async (e) => {
    e.preventDefault();
    const items = $$('#q-items .row').map(r => ({
      description: r.querySelector('.q-desc').value.trim(),
      quantity: Number(r.querySelector('.q-qty').value || 0),
      price: Number(r.querySelector('.q-price').value || 0),
    })).filter(i => i.description);

    if (items.length === 0) {
      alert('กรุณาเพิ่มอย่างน้อย 1 รายการ'); return;
    }

    const payload = {
      bookingId: $('#q-bookingId').value,
      items,
      discount: Number($('#q-discount').value || 0),
      customerName: $('#q-customerName').value.trim(),
      contactName: $('#q-contactName').value.trim(),
      customerTaxId: $('#q-customerTaxId').value.trim(),
      customerAddress: $('#q-customerAddress').value.trim(),
      projectName: $('#q-projectName').value.trim(),
      referenceNumber: $('#q-referenceNumber').value.trim(),
      creditTerm: Number($('#q-creditTerm').value || 0),
    };

    try {
      const res = await apiFetch('/api/quotes', { method: 'POST', json: payload });
      bootstrap.Modal.getInstance($('#quote-modal'))?.hide();
      window.showToast?.('สร้างใบเสนอราคาแล้ว');
      if (confirm('บันทึกสำเร็จ เปิดใบเสนอราคาเลยไหม?')) {
        location.href = `/quote-detail.html?id=${res._id || res.id}`;
      }
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    }
  };
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  loadBookings();
  loadSettings();
});
searchInput?.addEventListener('input', applyFilter);
statusFilter?.addEventListener('change', applyFilter);

// Logout handling is done in index.html inline script
