// public/customers.js — Robust Unified Logic
let customersData = [];
let currentLineUserId = null;

async function loadCustomers() {
  const token = sessionStorage.getItem('authToken');
  const tableBody = document.getElementById('customer-table-body');
  
  try {
    const res = await fetch('/api/customers', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    customersData = Array.isArray(data) ? data : (data.data || []);
    
    if (customersData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบข้อมูลลูกค้าในระบบ</td></tr>';
      return;
    }
    
    renderCustomerTable(customersData);
  } catch (e) {
    console.error('Load error:', e);
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>';
  }
}

function renderCustomerTable(list) {
  const tableBody = document.getElementById('customer-table-body');
  tableBody.innerHTML = list.map(c => {
    const pic = c.linePictureUrl ? `<img src="${c.linePictureUrl}" class="rounded-circle me-2" width="32">` : '<div class="bg-light rounded-circle me-2 d-inline-flex align-items-center justify-content-center" style="width:32px;height:32px;font-size:12px">👤</div>';
    const lineStatus = c.lineUserId ? '<span class="badge bg-success">เชื่อมต่อแล้ว</span>' : '<span class="badge border text-muted">ไม่ได้เชื่อมต่อ</span>';
    const lastActive = c.lastActive ? new Date(c.lastActive).toLocaleString('th-TH') : '-';
    
    return `<tr>
      <td>
        <div class="d-flex align-items-center">
          ${pic}
          <div>
            <div class="fw-bold">${c.name || 'ไม่ระบุชื่อ'}</div>
            <div class="text-muted small">${c.company || (c.lineDisplayName || 'ทั่วไป')}</div>
          </div>
        </div>
      </td>
      <td>${lineStatus}</td>
      <td>${c.phone || '-'}</td>
      <td class="small text-muted">${lastActive}</td>
      <td class="text-end">
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-outline-primary btn-message" data-userid="${c.lineUserId}" data-name="${c.name}" ${!c.lineUserId ? 'disabled' : ''}>
            💬 ส่งข้อความ
          </button>
          <button class="btn btn-sm btn-outline-secondary btn-edit-cust" data-id="${c._id}">
            ✏️ แก้ไข
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// Global scope functions for the "Add" button and others
window.openCustomerModal = (id = null) => {
  const modalEl = document.getElementById('customerModal');
  const form = document.getElementById('customer-form');
  const title = document.getElementById('customerModalTitle');
  
  form.reset();
  document.getElementById('customer-id').value = id || '';
  
  if (id) {
    title.textContent = '✏️ แก้ไขข้อมูลลูกค้า';
    const c = customersData.find(item => item._id === id);
    if (c) {
      document.getElementById('cust-name').value = c.name || '';
      document.getElementById('cust-company').value = c.company || '';
      document.getElementById('cust-taxId').value = c.taxId || '';
      document.getElementById('cust-phone').value = c.phone || '';
      document.getElementById('cust-email').value = c.email || '';
      document.getElementById('cust-social').value = c.social || '';
      document.getElementById('cust-address').value = c.address || '';
      document.getElementById('cust-notes').value = c.notes || '';
    }
  } else {
    title.textContent = '➕ เพิ่มลูกค้าใหม่';
  }
  
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
};

window.openMessageModal = (userId, name) => {
  if (!userId || userId === 'undefined' || userId === 'null') return;
  currentLineUserId = userId;
  document.getElementById('target-customer-name').textContent = name;
  document.getElementById('line-message-text').value = '';
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('sendMessageModal'));
  modal.show();
};

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  const searchInput = document.getElementById('search-customer');
  const customerForm = document.getElementById('customer-form');
  const sendBtn = document.getElementById('btn-send-line');
  const tableBody = document.getElementById('customer-table-body');

  // --- Event Delegation for Table Buttons ---
  tableBody.addEventListener('click', (e) => {
    const msgBtn = e.target.closest('.btn-message');
    if (msgBtn) {
      window.openMessageModal(msgBtn.dataset.userid, msgBtn.dataset.name);
      return;
    }
    
    const editBtn = e.target.closest('.btn-edit-cust');
    if (editBtn) {
      window.openCustomerModal(editBtn.dataset.id);
      return;
    }
  });

  // --- Search ---
  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = customersData.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.company || '').toLowerCase().includes(q) || 
      (c.phone || '').includes(q)
    );
    renderCustomerTable(filtered);
  });

  // --- Submit Form ---
  customerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const payload = {
      name: document.getElementById('cust-name').value.trim(),
      company: document.getElementById('cust-company').value.trim(),
      taxId: document.getElementById('cust-taxId').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim(),
      social: document.getElementById('cust-social').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      notes: document.getElementById('cust-notes').value.trim(),
    };

    try {
      const url = id ? `/api/customers/${id}` : '/api/customers';
      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
        window.layout?.showToast('บันทึกข้อมูลเรียบร้อย', 'success');
        loadCustomers();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (err) { alert('การเชื่อมต่อล้มเหลว'); }
  });

  // --- Send LINE ---
  sendBtn?.addEventListener('click', async () => {
    const message = document.getElementById('line-message-text').value.trim();
    if (!message || !currentLineUserId) return alert('กรุณาระบุข้อความ');

    sendBtn.disabled = true;
    try {
      const res = await fetch('/api/customers/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ lineUserId: currentLineUserId, message })
      });

      if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('sendMessageModal')).hide();
        window.layout?.showToast('ส่งข้อความสำเร็จ', 'success');
      } else {
        alert('ส่งไม่สำเร็จ');
      }
    } catch (err) { alert('เกิดข้อผิดพลาด'); }
    finally { sendBtn.disabled = false; }
  });

  loadCustomers();
});
