// public/create-quote.js — Browser only (works with your existing modals)

// helpers
function getToken() {
  const t = sessionStorage.getItem('authToken');
  if (!t) { location.replace('/login.html'); throw new Error('Missing token'); }
  return t;
}
function getAuthHeaders(isJson = true) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (isJson) h['Content-Type'] = 'application/json';
  return h;
}
async function apiFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Accept: 'application/json' }
  });
  if (res.status === 401 || res.status === 403) {
    sessionStorage.clear();
    alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    location.replace('/login.html');
    throw new Error('Unauthorized');
  }
  return res;
}
const fmt = n => Number(n||0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// เปิดฟอร์มเมื่อกดปุ่มใบเสนอราคา
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-make-quote');
  if (!btn) return;

  const bookingId = btn.dataset.id || btn.dataset.bookingId;
  if (!bookingId) return;

  const itemsWrap = document.getElementById('cq-items');
  const totalEl = document.getElementById('cq-total');

  const addRow = (it = {}) => {
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 align-items-center mb-2';
    row.innerHTML = `
      <input class="form-control cq-desc"  placeholder="คำอธิบาย" value="${it.description||''}">
      <input class="form-control cq-qty"   type="number" min="1" value="${it.quantity ?? 1}" style="max-width:100px">
      <input class="form-control cq-price" type="number" min="0" step="0.01" value="${it.price ?? 0}" style="max-width:140px">
      <button type="button" class="btn btn-sm btn-outline-danger cq-remove">ลบ</button>
    `;
    itemsWrap.appendChild(row);
  };

  const recalc = () => {
    let sum = 0;
    itemsWrap.querySelectorAll('.d-flex').forEach(r => {
      const q = Number(r.querySelector('.cq-qty').value || 0);
      const p = Number(r.querySelector('.cq-price').value || 0);
      sum += q * p;
    });
    totalEl.textContent = fmt(sum);
  };

  try {
    // โหลดการจอง
    const res = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      headers: { ...getAuthHeaders(false) }
    });
    const b = res.ok ? await res.json() : {};

    // เติมหัวบิล
    document.getElementById('cq-bookingId').value       = b._id || b.id || bookingId;
    document.getElementById('cq-customerName').value    = b.customer || b.customerName || '';
    document.getElementById('cq-contactName').value     = b.contactName  || '';
    document.getElementById('cq-customerTaxId').value   = b.customerTaxId || '';
    document.getElementById('cq-customerAddress').value = b.customerAddress || '';
    document.getElementById('cq-projectName').value     = b.projectName || b.bookingType || '';
    document.getElementById('cq-reference').value       = b.reference || '';

    // ล้าง/ใส่รายการ
    itemsWrap.innerHTML = '';
    addRow({ description: b.details || b.bookingType || '', quantity: 1, price: 0 });
    recalc();

    // bindings
    document.getElementById('cq-add-item').onclick = () => { addRow(); recalc(); };
    itemsWrap.onclick = (ev) => {
      if (ev.target.classList.contains('cq-remove')) {
        ev.target.closest('.d-flex')?.remove(); recalc();
      }
    };
    itemsWrap.oninput = recalc;

    // เปิด modal
    bootstrap.Modal.getOrCreateInstance(document.getElementById('createQuoteModal')).show();
  } catch (err) {
    console.error(err);
    alert('เปิดฟอร์มใบเสนอราคาไม่สำเร็จ');
  }
});

// submit ฟอร์ม สร้างใบเสนอราคา
document.getElementById('create-quote-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const items = Array.from(document.querySelectorAll('#cq-items .d-flex')).map(r => ({
    description: r.querySelector('.cq-desc').value.trim(),
    quantity: Number(r.querySelector('.cq-qty').value || 1),
    price: Number(r.querySelector('.cq-price').value || 0)
  })).filter(x => x.description);

  const payload = {
    bookingId:       document.getElementById('cq-bookingId').value,
    customerName:    document.getElementById('cq-customerName').value.trim(),
    contactName:     document.getElementById('cq-contactName').value.trim(),
    customerTaxId:   document.getElementById('cq-customerTaxId').value.trim(),
    customerAddress: document.getElementById('cq-customerAddress').value.trim(),
    creditTerm:      Number(document.getElementById('cq-creditTerm').value || 0),
    projectName:     document.getElementById('cq-projectName').value.trim(),
    reference:       document.getElementById('cq-reference').value.trim(),
    requiredDeposit: Number(document.getElementById('cq-requiredDeposit').value || 0),
    items
  };

  if (!payload.customerName) { alert('กรุณากรอกชื่อลูกค้า'); return; }
  if (!items.length) { alert('กรุณากรอกรายการอย่างน้อย 1 รายการ'); return; }

  try {
    const r1 = await fetch('/api/quotes', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload)
    });
    if (!r1.ok) throw new Error('create quote failed');
    const quote = await r1.json();

    bootstrap.Modal.getInstance(document.getElementById('createQuoteModal'))?.hide();
    if (confirm('บันทึกสำเร็จ เปิดใบเสนอราคาเลยไหม?')) {
      location.href = `/quote-detail.html?id=${encodeURIComponent(quote._id || quote.id)}`;
    } else {
      location.reload();
    }
  } catch (err) {
    console.error(err);
    alert('บันทึกใบเสนอราคาไม่สำเร็จ');
  }
});
