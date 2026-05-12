// public/quotes.js
// --- Auth helpers ---
function getAuthToken() {
  const t = sessionStorage.getItem('authToken');
  if (!t) { location.replace('/login.html'); throw new Error('Missing token'); }
  return t;
}
function getAuthHeaders(isJson = false) {
  const h = { Authorization: `Bearer ${getAuthToken()}` };
  if (isJson) h['Content-Type'] = 'application/json';
  return h;
}
async function apiFetch(input, init = {}) {
  const res = await fetch(input, init);
  if (res.status === 401 || res.status === 403) {
    sessionStorage.clear();
    alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    location.replace('/login.html');
    throw new Error('Unauthorized');
  }
  return res;
}
const money = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// แผนที่สถานะ ไทย <-> อังกฤษ
const QUOTE_STATUS_MAP = {
  Draft: 'ฉบับร่าง',
  Sent: 'ส่งแล้ว',
  Accepted: 'ยืนยันแล้ว',
  Declined: 'ปฏิเสธ'
};

document.addEventListener('DOMContentLoaded', () => {
  const quoteTableBody = document.getElementById('quote-table-body');
  const searchInput = document.getElementById('quote-search');
  const refreshBtn = document.getElementById('refresh-btn');
  const logoutBtn = document.getElementById('btn-logout');

  // Edit modal
  const editQuoteModalEl = document.getElementById('edit-quote-modal');
  const editQuoteModal = editQuoteModalEl ? new bootstrap.Modal(editQuoteModalEl) : null;
  const editQuoteForm = document.getElementById('edit-quote-form');
  const editQuoteIdInput = document.getElementById('edit-quote-id');
  const editQuoteItemsContainer = document.getElementById('edit-quote-items-container');
  const addEditItemBtn = document.getElementById('add-edit-item-btn');
  
  const editQuoteSubtotalVal = document.getElementById('edit-quote-subtotal-val');
  const editQuoteDiscountVal = document.getElementById('edit-quote-discount-val');
  const editQuoteGrandVal = document.getElementById('edit-quote-grand-val');
  const editQuoteDiscountInput = document.getElementById('edit-quote-discount');

  let allQuotes = [];

  function setRowMessage(html, danger=false){
    quoteTableBody.innerHTML = `<tr><td colspan="6" class="text-center ${danger?'text-danger':''} py-5">${html}</td></tr>`;
  }

  function renderQuotes(list) {
    quoteTableBody.innerHTML = '';
    if (!list.length) {
      setRowMessage('ยังไม่มีใบเสนอราคา');
      return;
    }

    list.forEach(q => {
      const tr = document.createElement('tr');
      const quoteDate = q.createdAt ? new Date(q.createdAt).toLocaleDateString('th-TH') : '-';
      const isAccepted = q.status === 'Accepted';

      const manageButtons = isAccepted
        ? `<a href="/invoices.html" class="btn btn-sm btn-success">ไปหน้าใบแจ้งหนี้</a>`
        : `<button class="btn btn-sm btn-outline-secondary edit-quote-btn" data-id="${q._id}">แก้ไข</button>`;

      tr.innerHTML = `
        <td><a href="/quote-detail.html?id=${q._id}&type=quote">${q.quoteNumber || '-'}</a></td>
        <td>${q.customerName || '-'}</td>
        <td class="text-end">${money(q.grandTotal || q.total)}</td>
        <td>${quoteDate}</td>
        <td>
          <select class="form-select form-select-sm status-select" data-id="${q._id}">
            ${Object.entries(QUOTE_STATUS_MAP).map(([en, th]) =>
              `<option value="${en}" ${q.status===en?'selected':''}>${th}</option>`).join('')}
          </select>
        </td>
        <td class="d-flex gap-2">
          ${manageButtons}
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${q._id}">ลบ</button>
        </td>
      `;
      quoteTableBody.appendChild(tr);
    });
  }

  async function fetchAndDisplayQuotes() {
  try {
    setRowMessage('กำลังโหลด...');
    const res = await apiFetch('/api/quotes', { headers: getAuthHeaders(false) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();

    allQuotes = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
    applyFilter();
  } catch (error) {
    console.error('Error fetching quotes:', error);
    setRowMessage('โหลดข้อมูลไม่สำเร็จ', true);
  }
}

  function applyFilter() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return renderQuotes(allQuotes);
    const filtered = allQuotes.filter(x => {
      const num = (x.quoteNumber || '').toLowerCase();
      const name = (x.customerName || '').toLowerCase();
      return num.includes(q) || name.includes(q);
    });
    renderQuotes(filtered);
  }

  // ตาราง: ลบ/แก้ไข
  quoteTableBody.addEventListener('click', async (e) => {
    const tgt = e.target;
    if (tgt.classList.contains('delete-btn')) {
      const id = tgt.dataset.id;
      if (!confirm('คุณแน่ใจว่าต้องการลบใบเสนอราคานี้?')) return;
      const res = await apiFetch(`/api/quotes/${id}`, { method: 'DELETE', headers: getAuthHeaders(false) });
      if (!res.ok) return alert('ลบไม่สำเร็จ');
      fetchAndDisplayQuotes();
      return;
    }
    if (tgt.classList.contains('edit-quote-btn')) {
      const id = tgt.dataset.id;
      loadQuoteForEdit(id);
      return;
    }
  });

  // เปลี่ยนสถานะ
  quoteTableBody.addEventListener('change', async (e) => {
    const el = e.target.closest('.status-select');
    if (!el) return;
    const id = el.dataset.id;
    const newStatus = el.value;

    const res = await apiFetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      alert('เปลี่ยนสถานะไม่สำเร็จ');
      return;
    }
    const data = await res.json().catch(()=>null);
    if (newStatus === 'Accepted' && data?.createdInvoiceId) {
      location.href = `/billing-detail.html?id=${data.createdInvoiceId}`;
      return;
    }
    fetchAndDisplayQuotes();
  });

  // ===== Edit modal Logic =====
  const recalcTotals = () => {
    let subtotal = 0;
    editQuoteItemsContainer.querySelectorAll('.edit-item-row').forEach(row => {
      const q = Number(row.querySelector('.edit-item-qty').value || 0);
      const p = Number(row.querySelector('.edit-item-price').value || 0);
      subtotal += q * p;
    });
    const discount = Number(editQuoteDiscountInput.value || 0);
    const grand = Math.max(0, subtotal - discount);

    editQuoteSubtotalVal.textContent = money(subtotal);
    editQuoteDiscountVal.textContent = money(discount);
    editQuoteGrandVal.textContent = money(grand);
  };

  async function loadQuoteForEdit(id) {
    const res = await apiFetch(`/api/quotes/${id}`, { headers: getAuthHeaders(false) });
    if (!res.ok) { alert('โหลดใบเสนอราคาไม่สำเร็จ'); return; }
    const quote = await res.json();

    editQuoteIdInput.value = quote._id;
    document.getElementById('edit-quote-customerName').value = quote.customerName || '';
    document.getElementById('edit-quote-contactName').value = quote.contactName || '';
    document.getElementById('edit-quote-customerTaxId').value = quote.customerTaxId || '';
    document.getElementById('edit-quote-customerAddress').value = quote.customerAddress || '';
    document.getElementById('edit-quote-projectName').value = quote.projectName || '';
    document.getElementById('edit-quote-referenceNumber').value = quote.referenceNumber || quote.reference || '';
    document.getElementById('edit-quote-creditTerm').value = quote.creditTerm ?? 30;
    editQuoteDiscountInput.value = quote.discount || 0;

    editQuoteItemsContainer.innerHTML = '';
    const items = Array.isArray(quote.items) && quote.items.length ? quote.items : [{}];
    items.forEach(it => addEditItem(it));

    recalcTotals();
    editQuoteModal?.show();
  }

  function addEditItem(item = {}) {
    const div = document.createElement('div');
    div.className = 'd-flex gap-2 mb-2 align-items-center edit-item-row';
    div.innerHTML = `
      <input type="text" class="form-control edit-item-desc" placeholder="คำอธิบาย" value="${item.description||''}" required>
      <input type="number" class="form-control edit-item-qty"  placeholder="จำนวน" value="${item.quantity ?? 1}" style="width:80px" min="0">
      <input type="number" class="form-control edit-item-price" placeholder="ราคาต่อหน่วย" value="${item.price ?? 0}" style="width:120px" required min="0" step="0.01">
      <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn">ลบ</button>
    `;
    editQuoteItemsContainer.appendChild(div);
  }

  addEditItemBtn?.addEventListener('click', () => { addEditItem(); recalcTotals(); });
  editQuoteItemsContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item-btn')) {
      e.target.closest('.edit-item-row')?.remove();
      recalcTotals();
    }
  });
  editQuoteItemsContainer?.addEventListener('input', recalcTotals);
  editQuoteDiscountInput?.addEventListener('input', recalcTotals);

  editQuoteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editQuoteIdInput.value;
    const items = [];
    editQuoteItemsContainer.querySelectorAll('.edit-item-row').forEach(row => {
      const desc = row.querySelector('.edit-item-desc').value.trim();
      if (desc) {
        items.push({
          description: desc,
          quantity: Number(row.querySelector('.edit-item-qty').value || 1),
          price: Number(row.querySelector('.edit-item-price').value || 0)
        });
      }
    });

    const payload = {
      customerName:    document.getElementById('edit-quote-customerName').value.trim(),
      contactName:     document.getElementById('edit-quote-contactName').value.trim(),
      customerTaxId:   document.getElementById('edit-quote-customerTaxId').value.trim(),
      customerAddress: document.getElementById('edit-quote-customerAddress').value.trim(),
      projectName:     document.getElementById('edit-quote-projectName').value.trim(),
      referenceNumber: document.getElementById('edit-quote-referenceNumber').value.trim(),
      creditTerm:      Number(document.getElementById('edit-quote-creditTerm').value || 0),
      discount:        Number(editQuoteDiscountInput.value || 0),
      items
    };

    const res = await apiFetch(`/api/quotes/${id}`, {
      method:'PUT', headers:getAuthHeaders(true), body:JSON.stringify(payload)
    });
    if (!res.ok) return alert('บันทึกไม่สำเร็จ');
    editQuoteModal?.hide();
    fetchAndDisplayQuotes();
  });

  // search/refresh/logout
  searchInput?.addEventListener('input', ()=>applyFilter());
  refreshBtn?.addEventListener('click', fetchAndDisplayQuotes);
  logoutBtn?.addEventListener('click', ()=>{ sessionStorage.clear(); location.replace('/login.html'); });

  // init
  fetchAndDisplayQuotes();
});
