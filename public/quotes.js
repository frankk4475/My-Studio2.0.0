// public/quotes.js — Complete Unified Logic
function money(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

  // Create modal
  const createQuoteForm = document.getElementById('create-quote-form');
  const cqItemsContainer = document.getElementById('cq-items');
  const cqAddItemBtn = document.getElementById('cq-add-item');
  const cqTotalEl = document.getElementById('cq-total');

  // Edit modal
  const editQuoteModalEl = document.getElementById('edit-quote-modal');
  const editQuoteModal = editQuoteModalEl ? new bootstrap.Modal(editQuoteModalEl) : null;
  const editQuoteForm = document.getElementById('edit-quote-form');
  
  let allQuotes = [];

  // --- Helper: Add Item Row ---
  function addRow(container, it = {}, type = 'cq') {
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = `
      <td><input type="text" class="form-control item-desc" placeholder="คำอธิบาย" value="${it.description||''}" required></td>
      <td><input type="number" class="form-control item-qty text-center" value="${it.quantity ?? 1}" min="1" style="width:80px"></td>
      <td><input type="number" class="form-control item-price text-end" value="${it.price ?? 0}" min="0" step="0.01" style="width:120px"></td>
      <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger remove-item-btn">🗑️</button></td>
    `;
    container.appendChild(tr);
    
    const recalc = type === 'cq' ? recalcCreateTotal : recalcEditTotals;
    tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalc));
    tr.querySelector('.remove-item-btn').onclick = () => { tr.remove(); recalc(); };
  }

  // --- Recalculate Totals ---
  function recalcCreateTotal() {
    let sum = 0;
    cqItemsContainer.querySelectorAll('.item-row').forEach(row => {
      const q = Number(row.querySelector('.item-qty').value || 0);
      const p = Number(row.querySelector('.item-price').value || 0);
      sum += q * p;
    });
    cqTotalEl.textContent = money(sum);
  }

  function recalcEditTotals() {
    let subtotal = 0;
    document.getElementById('edit-quote-items-container').querySelectorAll('.item-row').forEach(row => {
      const q = Number(row.querySelector('.item-qty').value || 0);
      const p = Number(row.querySelector('.item-price').value || 0);
      subtotal += q * p;
    });
    const discount = Number(document.getElementById('edit-quote-discount').value || 0);
    const grand = Math.max(0, subtotal - discount);

    document.getElementById('edit-quote-subtotal-val').textContent = money(subtotal);
    document.getElementById('edit-quote-grand-val').textContent = money(grand);
  }

  // --- Load and Render ---
  async function fetchAndDisplayQuotes() {
    try {
      quoteTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">กำลังโหลด...</td></tr>';
      const token = sessionStorage.getItem('authToken');
      const res = await fetch('/api/quotes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) return location.replace('/login.html');
      const body = await res.json();
      allQuotes = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      applyFilter();
    } catch (error) {
      console.error('Error:', error);
      quoteTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-danger">โหลดข้อมูลไม่สำเร็จ</td></tr>';
    }
  }

  function renderQuotes(list) {
    quoteTableBody.innerHTML = '';
    if (!list.length) {
      quoteTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลใบเสนอราคา</td></tr>';
      return;
    }

    list.forEach(q => {
      const tr = document.createElement('tr');
      const quoteDate = q.createdAt ? new Date(q.createdAt).toLocaleDateString('th-TH') : '-';
      const isAccepted = q.status === 'Accepted';

      tr.innerHTML = `
        <td><a href="/quote-detail.html?id=${q._id}" class="fw-bold text-primary">${q.quoteNumber || '-'}</a></td>
        <td>${q.customerName || '-'}</td>
        <td class="text-end fw-semibold">${money(q.grandTotal || q.total)}</td>
        <td>${quoteDate}</td>
        <td>
          <select class="form-select form-select-sm status-select" data-id="${q._id}">
            ${Object.entries(QUOTE_STATUS_MAP).map(([en, th]) =>
              `<option value="${en}" ${q.status===en?'selected':''}>${th}</option>`).join('')}
          </select>
        </td>
        <td class="text-end">
          <div class="d-flex gap-2 justify-content-end">
            ${isAccepted ? `<a href="/invoices.html" class="btn btn-sm btn-outline-success">บิล</a>` : `<button class="btn btn-sm btn-outline-secondary edit-quote-btn" data-id="${q._id}">แก้ไข</button>`}
            <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${q._id}">🗑️</button>
          </div>
        </td>
      `;
      quoteTableBody.appendChild(tr);
    });
  }

  function applyFilter() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const filtered = allQuotes.filter(x => {
      const num = (x.quoteNumber || '').toLowerCase();
      const name = (x.customerName || '').toLowerCase();
      return num.includes(q) || name.includes(q);
    });
    renderQuotes(filtered);
  }

  // --- Create Logic ---
  const btnCreate = document.getElementById('btn-create-quote');
  btnCreate?.addEventListener('click', () => {
    const bookingId = document.getElementById('cq-bookingId').value;
    if (!bookingId) {
        alert('กรุณาเลือกรายการจองจากหน้า "การจอง" เพื่อสร้างใบเสนอราคาครับ');
        // Prevent modal from showing if using Bootstrap data-bs-toggle
        const modal = bootstrap.Modal.getInstance(document.getElementById('createQuoteModal'));
        if (modal) modal.hide();
        location.href = '/index.html';
    }
  });

  cqAddItemBtn?.addEventListener('click', () => addRow(cqItemsContainer, {}, 'cq'));
  
  // AI Suggest Logic
  const aiSuggestBtn = document.getElementById('btn-ai-suggest');
  aiSuggestBtn?.addEventListener('click', async () => {
    const bookingId = document.getElementById('cq-bookingId').value;
    if (!bookingId) {
      alert('AI แนะนำข้อมูลได้ดีที่สุดเมื่อสร้างจากรายการจองครับ');
      return;
    }

    const originalText = aiSuggestBtn.innerHTML;
    aiSuggestBtn.innerHTML = '⌛ กำลังวิเคราะห์...';
    aiSuggestBtn.disabled = true;

    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch('/api/ai/suggest-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ bookingId })
      });
      const data = await res.json();
      if (res.ok && data.suggestions) {
        cqItemsContainer.innerHTML = '';
        data.suggestions.forEach(it => addRow(cqItemsContainer, it, 'cq'));
        recalcCreateTotal();
        window.layout?.showToast('AI แนะนำรายการให้แล้วครับ', 'success');
      } else {
        throw new Error(data.message || 'ไม่สามารถขอคำแนะนำได้');
      }
    } catch (err) {
      alert('AI Error: ' + err.message);
    } finally {
      aiSuggestBtn.innerHTML = originalText;
      aiSuggestBtn.disabled = false;
    }
  });

  createQuoteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = Array.from(cqItemsContainer.querySelectorAll('.item-row')).map(row => ({
      description: row.querySelector('.item-desc').value.trim(),
      quantity: Number(row.querySelector('.item-qty').value || 1),
      price: Number(row.querySelector('.item-price').value || 0)
    })).filter(it => it.description);

    if (!items.length) return alert('กรุณาเพิ่มอย่างน้อย 1 รายการ');

    const payload = {
      bookingId: document.getElementById('cq-bookingId').value,
      customerName: document.getElementById('cq-customerName').value.trim(),
      projectName: document.getElementById('cq-projectName').value.trim(),
      customerTaxId: document.getElementById('cq-customerTaxId').value.trim(),
      customerAddress: document.getElementById('cq-customerAddress').value.trim(),
      referenceNumber: document.getElementById('cq-reference').value.trim(),
      creditTerm: Number(document.getElementById('cq-creditTerm').value || 30),
      items
    };

    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create quote');
      
      bootstrap.Modal.getInstance(document.getElementById('createQuoteModal'))?.hide();
      window.layout?.showToast('สร้างใบเสนอราคาสำเร็จ', 'success');
      fetchAndDisplayQuotes();
      createQuoteForm.reset();
      cqItemsContainer.innerHTML = '';
      addRow(cqItemsContainer, {}, 'cq');
    } catch (err) { alert(err.message); }
  });

  // --- Edit/Delete/Status Logic ---
  quoteTableBody.addEventListener('click', async (e) => {
    const tgt = e.target.closest('.delete-btn');
    if (tgt) {
      if (!confirm('ยืนยันการลบใบเสนอราคา?')) return;
      const token = sessionStorage.getItem('authToken');
      await fetch(`/api/quotes/${tgt.dataset.id}`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      fetchAndDisplayQuotes();
    }

    const editBtn = e.target.closest('.edit-quote-btn');
    if (editBtn) {
      loadQuoteForEdit(editBtn.dataset.id);
    }
  });

  quoteTableBody.addEventListener('change', async (e) => {
    const el = e.target.closest('.status-select');
    if (!el) return;
    const token = sessionStorage.getItem('authToken');
    const res = await fetch(`/api/quotes/${el.dataset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: el.value })
    });
    if (res.ok) {
      const data = await res.json();
      if (el.value === 'Accepted' && data.createdInvoiceId) {
        location.href = `/billing-detail.html?id=${data.createdInvoiceId}`;
      } else {
        fetchAndDisplayQuotes();
      }
    }
  });

  async function loadQuoteForEdit(id) {
    const token = sessionStorage.getItem('authToken');
    const res = await fetch(`/api/quotes/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const quote = await res.json();

    document.getElementById('edit-quote-id').value = quote._id;
    document.getElementById('edit-quote-customerName').value = quote.customerName || '';
    document.getElementById('edit-quote-projectName').value = quote.projectName || '';
    document.getElementById('edit-quote-customerTaxId').value = quote.customerTaxId || '';
    document.getElementById('edit-quote-customerAddress').value = quote.customerAddress || '';
    document.getElementById('edit-quote-creditTerm').value = quote.creditTerm ?? 30;
    document.getElementById('edit-quote-discount').value = quote.discount || 0;

    const container = document.getElementById('edit-quote-items-container');
    container.innerHTML = '';
    (quote.items || [{}]).forEach(it => addRow(container, it, 'edit'));

    recalcEditTotals();
    editQuoteModal?.show();
  }

  editQuoteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = Array.from(document.getElementById('edit-quote-items-container').querySelectorAll('.item-row')).map(row => ({
      description: row.querySelector('.item-desc').value.trim(),
      quantity: Number(row.querySelector('.item-qty').value || 1),
      price: Number(row.querySelector('.item-price').value || 0)
    }));

    const payload = {
      customerName: document.getElementById('edit-quote-customerName').value.trim(),
      projectName: document.getElementById('edit-quote-projectName').value.trim(),
      customerTaxId: document.getElementById('edit-quote-customerTaxId').value.trim(),
      customerAddress: document.getElementById('edit-quote-customerAddress').value.trim(),
      creditTerm: Number(document.getElementById('edit-quote-creditTerm').value || 30),
      discount: Number(document.getElementById('edit-quote-discount').value || 0),
      items
    };

    const token = sessionStorage.getItem('authToken');
    const res = await fetch(`/api/quotes/${document.getElementById('edit-quote-id').value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      editQuoteModal.hide();
      fetchAndDisplayQuotes();
    }
  });

  // --- Init ---
  if (cqItemsContainer) {
    cqItemsContainer.innerHTML = '';
    addRow(cqItemsContainer, {}, 'cq');
    recalcCreateTotal();
  }

  // Auto-open create modal if bookingId is in URL
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('bookingId');
  if (bookingId) {
    (async () => {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch(`/api/bookings/${bookingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const b = await res.json();
        document.getElementById('cq-bookingId').value = b._id;
        document.getElementById('cq-customerName').value = b.customer;
        document.getElementById('cq-projectName').value = b.bookingType;
        document.getElementById('cq-customerAddress').value = b.details || '';
        
        cqItemsContainer.innerHTML = '';
        addRow(cqItemsContainer, { description: b.bookingType, quantity: 1, price: 0 }, 'cq');
        
        const modal = new bootstrap.Modal(document.getElementById('createQuoteModal'));
        modal.show();
      }
    })();
  }
  
  searchInput?.addEventListener('input', applyFilter);
  refreshBtn?.addEventListener('click', fetchAndDisplayQuotes);
  fetchAndDisplayQuotes();
});
