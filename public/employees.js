// public/employees.js
const token = () => sessionStorage.getItem('authToken');
const headers = () => ({ 
  'Authorization': 'Bearer ' + token(),
  'Content-Type': 'application/json' 
});

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
  const list = await apiFetch('/api/users/list');
  const tbody = document.getElementById('employee-table-body');
  tbody.innerHTML = '';

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">ไม่พบข้อมูลพนักงาน</td></tr>';
    return;
  }

  list.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold">${emp.displayName || emp.username}</td>
      <td class="text-muted small">${emp.username}</td>
      <td>${emp.jobTitle || '-'}</td>
      <td><span class="badge ${emp.role === 'Admin' ? 'bg-danger' : 'bg-info'}">${emp.role}</span></td>
      <td class="text-end">
        <div class="d-inline-flex gap-2">
          <button class="btn btn-sm btn-outline-primary btn-edit" 
                  data-id="${emp._id}" 
                  data-displayname="${emp.displayName || ''}" 
                  data-jobtitle="${emp.jobTitle || ''}" 
                  data-role="${emp.role}">แก้ไข</button>
          <button class="btn btn-sm btn-outline-danger btn-del" data-id="${emp._id}">ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addEmployeeModal')).hide();
    e.target.reset();
    loadEmployees();
  } else {
    const data = await res.json();
    alert(data.message || 'เกิดข้อผิดพลาด');
  }
});

document.getElementById('employee-table-body')?.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-del')) {
    if (!confirm('ยืนยันการลบพนักงาน?')) return;
    const id = e.target.dataset.id;
    const res = await apiFetch('/api/users/' + id, { method: 'DELETE' });
    if (res) loadEmployees();
  }

  if (e.target.classList.contains('btn-edit')) {
    const d = e.target.dataset;
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
  const id = fd.get('id');
  const json = Object.fromEntries(fd.entries());
  delete json.id;

  const res = await fetch('/api/users/' + id, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(json)
  });

  if (res.ok) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editEmployeeModal')).hide();
    loadEmployees();
  } else {
    const data = await res.json();
    alert(data.message || 'บันทึกการแก้ไขไม่สำเร็จ');
  }
});

document.addEventListener('DOMContentLoaded', loadEmployees);
