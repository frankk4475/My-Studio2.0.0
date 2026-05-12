// --- Auth helpers --- invoices.js
function getAuthToken(){
  const t = sessionStorage.getItem('authToken');
  if (!t) { location.replace('/login.html'); throw new Error('Missing token'); }
  return t;
}
function getAuthHeaders(isJson = true){
  const h = { Authorization: `Bearer ${getAuthToken()}` };
  if (isJson) h['Content-Type'] = 'application/json';
  return h;
}
async function apiFetch(input, init = {}){
  const res = await fetch(input, init);
  if (res.status === 401 || res.status === 403){
    sessionStorage.clear();
    alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    location.replace('/login.html');
    throw new Error('Unauthorized');
  }
  return res;
}
const money = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

document.addEventListener('DOMContentLoaded', () => {
  const tbody       = document.getElementById('invoice-table-body');
  const searchInput = document.getElementById('invoice-search');
  const refreshBtn  = document.getElementById('refresh-btn');
  const logoutBtn   = document.getElementById('btn-logout'); // << ให้ตรงกับ HTML

  // modal refs
  const modalEl   = document.getElementById('invoice-modal');
  const modal     = modalEl ? new bootstrap.Modal(modalEl) : null;
  const invCustomer = document.getElementById('inv-customer');
  const invTotal    = document.getElementById('inv-total');
  const invIssue    = document.getElementById('inv-issue-date');
  const invDue      = document.getElementById('inv-due-date');
  const invStatus   = document.getElementById('inv-payment-status');
  const invItems    = document.getElementById('inv-items');
  const invIdHidden = document.getElementById('inv-id');

  let all = [];

  function render(list){
    tbody.innerHTML = '';
    if (!list.length){
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">ยังไม่มีใบแจ้งหนี้</td></tr>';
      return;
    }
    list.forEach(inv => {
      const due  = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('th-TH') : '-';
      const paid = inv.paymentStatus === 'Paid';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="nowrap">${inv.invoiceNumber || '-'}</td>
        <td class="nowrap">${inv.customerName || '-'}</td>
        <td class="text-end nowrap">${money(inv.total)}</td>
        <td class="nowrap">${due}</td>
        <td class="nowrap">
          <select class="form-select form-select-sm payment-status-select" data-id="${inv._id || inv.id}">
            <option value="Unpaid" ${inv.paymentStatus === 'Unpaid' ? 'selected' : ''}>ยังไม่ชำระ</option>
            <option value="Paid" ${paid ? 'selected' : ''}>ชำระแล้ว</option>
          </select>
        </td>
        <td class="nowrap">
          <div class="d-inline-flex gap-2">
            <button class="btn btn-sm btn-outline-secondary btn-view" data-id="${inv._id || inv.id}">ดูรายละเอียด</button>
            ${paid
              ? `<a class="btn btn-sm btn-success" href="/receipt-detail.html?id=${inv._id || inv.id}">ดูใบเสร็จ</a>`
              : `<button class="btn btn-sm btn-outline-primary btn-edit-inv" data-id="${inv._id || inv.id}">แก้ไข</button>
                 <a class="btn btn-sm btn-outline-primary" href="/billing-detail.html?id=${inv._id || inv.id}">ดูใบแจ้งหนี้</a>`
            }
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function fetchAll(){
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5">กำลังโหลด...</td></tr>`;
    const res = await apiFetch('/api/invoices', { headers:getAuthHeaders(false) });
if(!res.ok){ /* ... */ return; }
const body = await res.json();
all = Array.isArray(body) ? body : (body.data || []);  // <<— รองรับ {data:[]}
applyFilter();

  }

  function applyFilter(){
    const q = (searchInput?.value || '').trim().toLowerCase();
    const filtered = !q ? all : all.filter(inv => {
      const a = (inv.invoiceNumber || '').toLowerCase();
      const b = (inv.customerName  || '').toLowerCase();
      return a.includes(q) || b.includes(q);
    });
    render(filtered);
  }

  // events
  refreshBtn?.addEventListener('click', fetchAll);
  searchInput?.addEventListener('input', (() => { let t; return () => { clearTimeout(t); t = setTimeout(applyFilter, 120); }; })());
  logoutBtn?.addEventListener('click', () => { sessionStorage.clear(); location.replace('/login.html'); });

  tbody.addEventListener('change', async (e) => {
    const el = e.target.closest('.payment-status-select'); if (!el) return;
    const res = await apiFetch(`/api/invoices/${el.dataset.id}`, {
      method: 'PUT', headers: getAuthHeaders(true), body: JSON.stringify({ paymentStatus: el.value })
    });
    if (!res.ok) alert('อัปเดตสถานะไม่สำเร็จ');
    await fetchAll();
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-view'); if (!btn) return;
    const res = await apiFetch(`/api/invoices/${btn.dataset.id}`, { headers: getAuthHeaders(false) });
    if (!res.ok) return alert('โหลดไม่สำเร็จ');
    const inv = await res.json();

    document.getElementById('invoice-modal-title').textContent = inv.invoiceNumber || 'รายละเอียดใบแจ้งหนี้';
    invCustomer.textContent = inv.customerName || '-';
    invTotal.textContent    = money(inv.total);
    invIssue.textContent    = inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('th-TH') : '-';
    invDue.textContent      = inv.dueDate   ? new Date(inv.dueDate).toLocaleDateString('th-TH')   : '-';
    invStatus.value         = inv.paymentStatus || 'Unpaid';
    invIdHidden.value       = inv._id || inv.id;

    invItems.innerHTML = '';
    (inv.items || []).forEach(it => {
      const qty = Number(it.quantity || 1), price = Number(it.price || 0);
      const li  = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `<span>${it.description || '-'} <small class="text-muted">x${qty}</small></span><span>${money(qty * price)}</span>`;
      invItems.appendChild(li);
    });

    modal?.show();
  });

  document.getElementById('save-invoice-btn')?.addEventListener('click', async () => {
    const id = document.getElementById('inv-id').value;
    const st = document.getElementById('inv-payment-status').value;
    const res = await apiFetch(`/api/invoices/${id}`, {
      method: 'PUT', headers: getAuthHeaders(true), body: JSON.stringify({ paymentStatus: st })
    });
    if (!res.ok) return alert('บันทึกไม่สำเร็จ');
    modal?.hide();
    await fetchAll();
  });

  // ===== Edit Invoice Modal Logic =====
  const editModalEl = document.getElementById('edit-invoice-modal');
  const editModal   = editModalEl ? new bootstrap.Modal(editModalEl) : null;
  const editInvForm = document.getElementById('edit-invoice-form');
  const editInvId   = document.getElementById('edit-inv-id');
  const editInvCust = document.getElementById('edit-inv-customer');
  const editInvTax  = document.getElementById('edit-inv-taxid');
  const editInvAddr = document.getElementById('edit-inv-address');
  const editItemsContainer = document.getElementById('edit-inv-items-container');
  const addEditItemBtn     = document.getElementById('add-edit-inv-item-btn');

  function addEditItemRow(it = {}) {
    const div = document.createElement('div');
    div.className = 'd-flex gap-2 mb-2 align-items-center';
    div.innerHTML = `
      <input type="text" class="form-control edit-item-desc" placeholder="คำอธิบาย" value="${it.description||''}" required>
      <input type="number" class="form-control edit-item-qty" placeholder="จำนวน" value="${it.quantity ?? 1}" style="width:80px">
      <input type="number" class="form-control edit-item-price" placeholder="ราคา" value="${it.price ?? 0}" style="width:120px" required>
      <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn">ลบ</button>
    `;
    editItemsContainer.appendChild(div);
  }

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-edit-inv'); if (!btn) return;
    const res = await apiFetch(`/api/invoices/${btn.dataset.id}`, { headers: getAuthHeaders(false) });
    if (!res.ok) return alert('โหลดข้อมูลไม่สำเร็จ');
    const inv = await res.json();

    editInvId.value   = inv._id || inv.id;
    editInvCust.value = inv.customerName || '';
    editInvTax.value  = inv.customerTaxId || '';
    editInvAddr.value = inv.customerAddress || '';

    editItemsContainer.innerHTML = '';
    const items = (inv.items && inv.items.length) ? inv.items : [{}];
    items.forEach(it => addEditItemRow(it));

    editModal?.show();
  });

  addEditItemBtn?.addEventListener('click', () => addEditItemRow());
  editItemsContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item-btn')) {
      e.target.closest('.d-flex')?.remove();
    }
  });

  editInvForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editInvId.value;
    const items = [];
    editItemsContainer.querySelectorAll('.d-flex').forEach(row => {
      items.push({
        description: row.querySelector('.edit-item-desc').value.trim(),
        quantity:    Number(row.querySelector('.edit-item-qty').value || 1),
        price:       Number(row.querySelector('.edit-item-price').value || 0)
      });
    });

    // Calculate total, grandTotal etc if needed on backend, 
    // but here we just send the items and basic info.
    const payload = {
      customerName:    editInvCust.value.trim(),
      customerTaxId:   editInvTax.value.trim(),
      customerAddress: editInvAddr.value.trim(),
      items:           items,
      total:           items.reduce((acc, it) => acc + (it.quantity * it.price), 0),
      grandTotal:      items.reduce((acc, it) => acc + (it.quantity * it.price), 0) // Simplified
    };

    const res = await apiFetch(`/api/invoices/${id}`, {
      method: 'PUT', headers: getAuthHeaders(true), body: JSON.stringify(payload)
    });
    if (!res.ok) return alert('บันทึกการแก้ไขไม่สำเร็จ');
    editModal?.hide();
    await fetchAll();
  });

  fetchAll();
});
