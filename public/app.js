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
const searchInput = document.getElementById('search-booking');
const statusFilter = document.getElementById('status-filter');
const refreshBtn = document.getElementById('btn-refresh');

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

function renderList(rows) {
  if (!rows.length) {
    listEl.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-muted">ไม่พบข้อมูล</td></tr>';
    return;
  }
  
  listEl.innerHTML = rows.map(b => {
    const id = b._id || b.id;
    const statusMap = {
      'Pending': { class: 'badge-warning', text: 'รอยืนยัน' },
      'Confirmed': { class: 'badge-success', text: 'ยืนยันแล้ว' },
      'Cancelled': { class: 'badge-danger', text: 'ยกเลิก' }
    };
    const s = statusMap[b.status] || { class: 'badge-info', text: b.status };

    return `
      <tr>
        <td>${fmtDate(b.date)}</td>
        <td>${esc(b.startTime)} - ${esc(b.endTime)}</td>
        <td>
          <div class="fw-bold">${esc(b.customer)}</div>
          <div class="small text-muted">${esc(b.contactPhone)}</div>
        </td>
        <td>${esc(b.bookingType)}</td>
        <td><span class="badge ${s.class}">${s.text}</span></td>
        <td style="text-align: right;">
          <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline btn-edit" data-id="${id}">แก้ไข</button>
            <button class="btn btn-sm btn-primary" data-action="make-quote" data-id="${id}">ใบเสนอราคา</button>
            <button class="btn btn-sm btn-outline btn-delete" data-id="${id}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
    layout.showToast?.('โหลดรายการล้มเหลว: ' + (e.message || e), true);
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
    layout.showToast?.('เพิ่มการจองแล้ว');
    await loadBookings();
    addForm.reset();
  } catch (err) {
    layout.showToast?.('บันทึกไม่สำเร็จ: ' + (err.message || err), true);
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
      layout.showToast?.('ลบสำเร็จ');
      await loadBookings();
    } catch (err) {
      layout.showToast?.('ลบไม่สำเร็จ: ' + (err.message || err), true);
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
      // Switch back to first tab
      bootstrap.Tab.getOrCreateInstance(document.getElementById('details-tab')).show();
      // Hide AI results
      document.getElementById('ai-result-container')?.classList.add('d-none');
    } catch (err) {
      layout.showToast?.('โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err), true);
    }
    return;
  }

  // --- AI ASSISTANT BUTTONS ---
  const aiBtn = t.closest('#btn-ai-shotlist, #btn-ai-equipment, #btn-ai-email');
  if (aiBtn) {
    const id = document.getElementById('edit-id').value;
    const type = aiBtn.id.replace('btn-ai-', ''); // shotlist, equipment, email
    const container = document.getElementById('ai-result-container');
    const content = document.getElementById('ai-result-content');
    const loading = document.getElementById('ai-loading');
    const title = document.getElementById('ai-result-title');

    const titles = {
        shotlist: '📸 แผนการถ่ายงาน (Shot List)',
        equipment: '📦 อุปกรณ์ที่แนะนำ',
        email: '📧 ร่างข้อความสื่อสาร'
    };

    const endpoints = {
        shotlist: '/api/ai/shot-list',
        equipment: '/api/ai/suggest-equipment',
        email: '/api/ai/draft-email'
    };

    container.classList.add('d-none');
    loading.classList.remove('d-none');
    title.textContent = titles[type];

    try {
        const payload = { bookingId: id };
        if (type === 'email') {
            payload.type = 'quote'; // Default for now
            payload.docId = id; // This might need logic to find actual quote ID
        }

        const res = await apiFetch(endpoints[type], { 
            method: 'POST', 
            json: payload 
        });

        content.textContent = res.creativeDirection || res.equipmentList || res.draft || 'ไม่มีข้อมูล';
        container.classList.remove('d-none');
    } catch (err) {
        layout.showToast?.('AI Error: ' + err.message, true);
    } finally {
        loading.classList.add('d-none');
    }
    return;
  }

  // ใบเสนอราคา
  const btnQuote = t.closest('[data-action="make-quote"]');
  if (btnQuote) {
    const id = btnQuote.dataset.id;
    try {
        const booking = await apiFetch('/api/bookings/' + id);
        openQuoteModal(booking);
    } catch (err) {
        layout.showToast?.('โหลดข้อมูลการจองไม่สำเร็จ', true);
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
    layout.showToast?.('บันทึกแล้ว');
    await loadBookings();
  } catch (err) {
    layout.showToast?.('บันทึกไม่สำเร็จ: ' + (err.message || err), true);
  }
});

refreshBtn?.addEventListener('click', loadBookings);

/* ========= ส่วนของ Modal “สร้างใบเสนอราคา” ========= */
function ensureQuoteModal() {
  if (document.getElementById('quote-modal')) return;
  
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal fade" id="quote-modal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <form class="modal-content" id="quote-form">
          <div class="modal-header">
            <h5 class="modal-title fw-bold">📝 สร้างใบเสนอราคา</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="q-bookingId">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">ชื่อลูกค้า</label>
                <input type="text" id="q-customerName" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">ชื่อโปรเจกต์</label>
                <input type="text" id="q-projectName" class="form-control">
              </div>
              <div class="col-md-6">
                <label class="form-label">เงินมัดจำ (Deposit)</label>
                <input type="number" id="q-requiredDeposit" class="form-control" value="0">
              </div>
            </div>
            
            <div class="mt-4 d-flex justify-content-between align-items-center mb-2">
              <label class="fw-bold">รายการสินค้า/บริการ</label>
              <button type="button" class="btn btn-sm btn-outline-info" id="btn-ai-suggest">✨ AI ช่วยแนะนำรายการ</button>
            </div>
            
            <div id="q-items"></div>
            <button type="button" class="btn btn-outline-secondary btn-sm mt-2" id="q-add-item">+ เพิ่มรายการ</button>
            
            <hr>
            <div class="row justify-content-end">
              <div class="col-md-5">
                <div class="d-flex justify-content-between mb-1">
                  <span>ส่วนลด (บาท):</span>
                  <input type="number" id="q-discount" class="form-control form-control-sm w-50" value="0">
                </div>
                <div class="d-flex justify-content-between fw-bold mt-2 pt-2 border-top">
                  <span>ยอดรวมสุทธิ:</span>
                  <span id="q-grand">0.00</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" data-bs-dismiss="modal">ยกเลิก</button>
            <button type="submit" class="btn btn-primary">💾 บันทึกและสร้างใบเสนอราคา</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('modal-container').appendChild(div.firstElementChild);
}

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
  const rows = Array.from(document.querySelectorAll('#q-items .row'));
  let sub = 0;
  rows.forEach(r => {
    const qty = Math.max(0, Number(r.querySelector('.q-qty')?.value || 0));
    const price = Math.max(0, Number(r.querySelector('.q-price')?.value || 0));
    sub += qty * price;
  });
  const disc = Math.max(0, Number(document.getElementById('q-discount')?.value || 0));
  const grand = Math.max(sub - disc, 0);
  document.getElementById('q-grand').textContent = grand.toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

async function openQuoteModal(booking) {
  ensureQuoteModal();
  const modalEl = document.getElementById('quote-modal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  document.getElementById('q-bookingId').value = booking?._id || booking?.id || '';
  document.getElementById('q-customerName').value = booking?.customer || '';
  document.getElementById('q-projectName').value = booking?.bookingType || '';
  document.getElementById('q-discount').value = 0;
  document.getElementById('q-requiredDeposit').value = 0;

  const box = document.getElementById('q-items');
  box.innerHTML = '';
  addItemRow(box, { description: booking?.bookingType || '', quantity: 1, price: 0 });

  document.getElementById('q-add-item').onclick = () => addItemRow(box);
  document.getElementById('q-discount').oninput = recalcQuote;

  // AI Suggest logic
  document.getElementById('btn-ai-suggest').onclick = async () => {
    const btn = document.getElementById('btn-ai-suggest');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⌛ กำลังวิเคราะห์...';
    btn.disabled = true;
    
    try {
      const res = await apiFetch('/api/ai/suggest-quote', { 
        method: 'POST', 
        json: { bookingId: booking._id || booking.id } 
      });
      
      if (res.suggestions && res.suggestions.length > 0) {
        box.innerHTML = ''; // Clear current
        res.suggestions.forEach(item => addItemRow(box, item));
        recalcQuote();
        if (window.layout) window.layout.showToast('AI แนะนำรายการให้แล้วครับ', 'success');
      }
    } catch (err) {
      alert('AI Suggestion failed: ' + err.message);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  recalcQuote();
  modal.show();

  document.getElementById('quote-form').onsubmit = async (e) => {
    e.preventDefault();
    const items = Array.from(box.querySelectorAll('.row')).map(r => ({
      description: r.querySelector('.q-desc').value.trim(),
      quantity: Number(r.querySelector('.q-qty').value || 0),
      price: Number(r.querySelector('.q-price').value || 0),
    })).filter(i => i.description);

    if (items.length === 0) {
      alert('กรุณาเพิ่มอย่างน้อย 1 รายการ'); return;
    }

    const payload = {
      bookingId: document.getElementById('q-bookingId').value,
      items,
      discount: Number(document.getElementById('q-discount').value || 0),
      customerName: document.getElementById('q-customerName').value.trim(),
      projectName: document.getElementById('q-projectName').value.trim(),
      requiredDeposit: Number(document.getElementById('q-requiredDeposit').value || 0),
    };

    try {
      const res = await apiFetch('/api/quotes', { method: 'POST', json: payload });
      modal.hide();
      if (window.layout) window.layout.showToast('สร้างใบเสนอราคาแล้ว', 'success');
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

// Listen for real-time updates from layout.js
window.addEventListener('bookingChanged', () => {
  console.log('🔄 App: Refreshing booking list due to real-time update...');
  loadBookings();
});

searchInput?.addEventListener('input', applyFilter);
statusFilter?.addEventListener('change', applyFilter);
