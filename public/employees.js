// public/employees.js — Modernized with Messaging Hub

const token = () => sessionStorage.getItem('authToken');
const headers = () => ({ 
  'Authorization': 'Bearer ' + token(),
  'Content-Type': 'application/json' 
});

let allEmployees = [];

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: headers()
  });
  if (res.status === 401 || res.status === 403) {
    location.replace('/login.html?reason=expired');
    return;
  }
  return res.json();
}

async function loadEmployees() {
  const tbody = document.getElementById('employee-table-body');
  const staffContainer = document.getElementById('staff-select-container');
  
  try {
    const list = await apiFetch('/api/users/list');
    allEmployees = list || [];
    
    // 1. Render Table
    tbody.innerHTML = '';
    if (allEmployees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลพนักงาน</td></tr>';
    } else {
      allEmployees.forEach(emp => {
        const lineStatus = emp.lineUserId ? '<span class="badge bg-success">Linked</span>' : '<span class="badge border text-muted">Not Linked</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold">${emp.displayName || emp.username}</td>
          <td class="text-muted small">${emp.username}</td>
          <td class="text-center">${lineStatus}</td>
          <td>${emp.jobTitle || '-'}</td>
          <td><span class="badge ${emp.role === 'Admin' ? 'bg-danger' : 'bg-info'}">${emp.role}</span></td>
          <td class="text-end">
            <div class="d-inline-flex gap-2">
              <button class="btn btn-sm btn-outline-primary btn-edit" 
                      data-id="${emp._id}" 
                      data-displayname="${emp.displayName || ''}" 
                      data-jobtitle="${emp.jobTitle || ''}" 
                      data-role="${emp.role}">แก้ไข</button>
              <button class="btn btn-sm btn-outline-danger btn-del" data-id="${emp._id}">🗑️</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 2. Render Messaging Selection
    renderStaffSelection();

  } catch (err) {
    console.error('Load Employees Error:', err);
  }
}

function renderStaffSelection() {
  const container = document.getElementById('staff-select-container');
  const linkedStaff = allEmployees.filter(e => e.lineUserId);
  
  if (linkedStaff.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-muted small">ไม่มีพนักงานที่เชื่อมต่อ LINE</div>';
    document.getElementById('btn-send-staff-msg').disabled = true;
    return;
  }

  container.innerHTML = linkedStaff.map(emp => `
    <label class="list-group-item d-flex align-items-center gap-3 py-3" style="cursor: pointer;">
      <input class="form-check-input flex-shrink-0 staff-checkbox" type="checkbox" value="${emp.lineUserId}">
      <div>
        <div class="fw-bold">${emp.displayName || emp.username}</div>
        <div class="small text-muted">${emp.jobTitle || 'พนักงาน'}</div>
      </div>
    </label>
  `).join('');
  
  // Enable button if text exists and someone is selected
  const checkState = () => {
    const hasText = document.getElementById('staff-msg-text').value.trim().length > 0;
    const hasSelected = document.querySelectorAll('.staff-checkbox:checked').length > 0;
    document.getElementById('btn-send-staff-msg').disabled = !(hasText && hasSelected);
  };

  document.getElementById('staff-msg-text').addEventListener('input', checkState);
  container.addEventListener('change', checkState);
}

// --- Event Handlers ---

document.getElementById('add-employee-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const json = Object.fromEntries(fd.entries());
  
  const res = await fetch('/api/users/register', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(json)
  });
  
  if (res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal')).hide();
    if (window.layout) window.layout.showToast('เพิ่มพนักงานสำเร็จ', 'success');
    e.target.reset();
    loadEmployees();
  } else {
    const data = await res.json();
    alert(data.message || 'เกิดข้อผิดพลาด');
  }
});

document.getElementById('employee-table-body')?.addEventListener('click', async (e) => {
  const delBtn = e.target.closest('.btn-del');
  if (delBtn) {
    if (!confirm('ยืนยันการลบพนักงาน?')) return;
    const id = delBtn.dataset.id;
    await apiFetch('/api/users/' + id, { method: 'DELETE' });
    if (window.layout) window.layout.showToast('ลบพนักงานเรียบร้อย', 'success');
    loadEmployees();
  }

  const editBtn = e.target.closest('.btn-edit');
  if (editBtn) {
    const d = editBtn.dataset;
    document.getElementById('edit-emp-id').value = d.id;
    document.getElementById('edit-emp-displayName').value = d.displayname;
    document.getElementById('edit-emp-jobTitle').value = d.jobtitle;
    document.getElementById('edit-emp-role').value = d.role;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editEmployeeModal')).show();
  }
});

document.getElementById('edit-employee-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = document.getElementById('edit-emp-id').value;
  const json = Object.fromEntries(fd.entries());
  delete json.id;

  const res = await fetch('/api/users/' + id, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(json)
  });

  if (res.ok) {
    bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal')).hide();
    if (window.layout) window.layout.showToast('อัปเดตข้อมูลพนักงานสำเร็จ', 'success');
    loadEmployees();
  }
});

// Broadcast LINE Message to Selected Staff
document.getElementById('btn-send-staff-msg')?.addEventListener('click', async () => {
  const message = document.getElementById('staff-msg-text').value.trim();
  const selectedIds = Array.from(document.querySelectorAll('.staff-checkbox:checked')).map(cb => cb.value);
  const btn = document.getElementById('btn-send-staff-msg');

  if (!message || selectedIds.length === 0) return;

  btn.disabled = true;
  btn.innerHTML = '⌛ กำลังส่งประกาศ...';

  try {
    let successCount = 0;
    for (const lineUserId of selectedIds) {
      const res = await fetch('/api/customers/send-staff-message', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ lineUserId, message })
      });
      if (res.ok) successCount++;
    }
    
    if (window.layout) window.layout.showToast(`ส่งประกาศสำเร็จ (${successCount}/${selectedIds.length})`, 'success');
    document.getElementById('staff-msg-text').value = '';
    document.querySelectorAll('.staff-checkbox').forEach(cb => cb.checked = false);
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการส่งข้อความ');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 ส่งข้อความประกาศ';
  }
});

document.addEventListener('DOMContentLoaded', loadEmployees);
