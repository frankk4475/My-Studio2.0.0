// public/tasks.js — Modernized Task & Equipment Logic

const getToken = () => sessionStorage.getItem('authToken');
const getHeaders = () => ({ 
  'Authorization': 'Bearer ' + getToken(),
  'Content-Type': 'application/json' 
});

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(path, { ...options, headers: getHeaders() });
    if (res.status === 401 || res.status === 403) {
      location.replace('/login.html?reason=expired');
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API Error');
    return data;
  } catch (err) {
    console.error(`Fetch Error [${path}]:`, err);
    throw err;
  }
}

let allEquipment = [];
let html5QrCode = null;

/**
 * DATA LOADING
 */
async function loadPageData() {
  const spinner = document.getElementById('loading-spinner');
  const errorAlert = document.getElementById('error-alert');
  const listBody = document.getElementById('assignments-list');

  try {
    spinner?.classList.remove('d-none');
    errorAlert?.classList.add('d-none');

    const [assignments, bookingsRaw, equipment, users] = await Promise.all([
      apiFetch('/api/assignments'),
      apiFetch('/api/bookings'),
      apiFetch('/api/equipment'),
      apiFetch('/api/users/list')
    ]);

    allEquipment = equipment || [];
    const bookings = Array.isArray(bookingsRaw) ? bookingsRaw : (bookingsRaw?.data || []);

    // 1. Fill Modals
    fillAssignmentModal(bookings, allEquipment, users);
    
    // 2. Render Assignments Table
    renderAssignments(assignments);

    spinner?.classList.add('d-none');
  } catch (err) {
    spinner?.classList.add('d-none');
    errorAlert?.classList.remove('d-none');
    console.error('Failed to load tasks page:', err);
  }
}

function fillAssignmentModal(bookings, equipment, users) {
  const bSelect = document.getElementById('booking-select');
  const eSelect = document.getElementById('employee-select');
  const equipBox = document.getElementById('equip-checkboxes');

  if (bSelect) {
    bSelect.innerHTML = '<option value="">-- เลือกรายการจอง --</option>';
    bookings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b._id;
      opt.textContent = `${b.customer} - ${new Date(b.date).toLocaleDateString('th-TH')} (${b.bookingType})`;
      bSelect.appendChild(opt);
    });
  }

  if (eSelect) {
    eSelect.innerHTML = '<option value="">-- เลือกพนักงาน --</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u._id;
      opt.textContent = `${u.displayName || u.username} (${u.jobTitle || 'พนักงาน'})`;
      eSelect.appendChild(opt);
    });
  }

  if (equipBox) {
    equipBox.innerHTML = '';
    const available = equipment.filter(e => e.status === 'Available');
    if (available.length === 0) {
      equipBox.innerHTML = '<div class="col-12 text-center py-2 text-muted small">ไม่มีอุปกรณ์ว่าง</div>';
    } else {
      available.forEach(e => {
        const div = document.createElement('div');
        div.className = 'col-md-6 mb-2';
        div.innerHTML = `
          <div class="form-check p-2 border rounded bg-white h-100">
            <input class="form-check-input ms-0 me-2 equip-check" type="checkbox" value="${e._id}" id="eq-${e._id}" data-barcode="${e.barcode || e.serialNumber || ''}">
            <label class="form-check-label small" for="eq-${e._id}" style="cursor:pointer">
              <strong>${e.name}</strong><br>
              <span class="text-muted" style="font-size:0.7rem">${e.category} | SN: ${e.serialNumber || '-'}</span>
            </label>
          </div>
        `;
        equipBox.appendChild(div);
      });
    }
  }
}

function renderAssignments(list) {
  const listBody = document.getElementById('assignments-list');
  if (!listBody) return;
  listBody.innerHTML = '';

  if (!list || list.length === 0) {
    listBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">ยังไม่มีประวัติการเบิกของ</td></tr>';
    return;
  }

  listBody.innerHTML = list.map(item => {
    const equipList = (item.equipmentIds || []).map(e => `<span class="badge badge-info me-1 mb-1">${e.name}</span>`).join('');
    
    let statusBadge = '';
    if (item.status === 'Completed') statusBadge = '<span class="badge badge-success">คืนแล้ว</span>';
    else if (item.status === 'In Progress') statusBadge = '<span class="badge badge-warning">กำลังใช้งาน</span>';
    else statusBadge = '<span class="badge border text-muted">รอรับของ</span>';

    return `
      <tr>
        <td><div class="fw-bold text-primary">${item.documentNumber || '-'}</div></td>
        <td>
          <div class="fw-bold">${item.bookingId?.customer || 'ไม่พบข้อมูลลูกค้า'}</div>
          <div class="small text-muted">${item.bookingId?.bookingType || '-'} | ${new Date(item.assignedAt).toLocaleDateString('th-TH')}</div>
        </td>
        <td>${item.employeeId?.displayName || item.employeeId?.username || 'N/A'}</td>
        <td style="max-width: 300px;">${equipList || '<span class="text-muted small">ไม่ได้ระบุ</span>'}</td>
        <td>${statusBadge}</td>
        <td class="text-end">
          <div class="d-flex gap-2 justify-content-end">
            <a href="/loan-detail.html?id=${item._id}" class="btn btn-sm btn-outline" title="พิมพ์ใบเบิก">🖨️</a>
            ${item.status !== 'Completed' ? `
              <button class="btn btn-sm btn-primary btn-complete" data-id="${item._id}">คืนของ</button>
              <button class="btn btn-sm btn-outline-secondary btn-edit-task" data-id="${item._id}" data-desc="${item.taskDescription || ''}" data-status="${item.status}">✏️</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * BARCODE & SCANNER
 */
function selectItemByBarcode(code) {
  const checkboxes = document.querySelectorAll('.equip-check');
  let found = false;
  checkboxes.forEach(cb => {
    if (cb.dataset.barcode === code || cb.value === code) {
      cb.checked = true;
      const parent = cb.closest('.form-check');
      parent.classList.add('bg-warning', 'bg-opacity-25', 'border-warning');
      setTimeout(() => parent.classList.remove('bg-warning', 'bg-opacity-25', 'border-warning'), 2500);
      found = true;
    }
  });
  if (!found) {
    if (window.layout) window.layout.showToast('ไม่พบอุปกรณ์ที่มีรหัส: ' + code, 'warning');
    else alert('ไม่พบอุปกรณ์ที่มีรหัส: ' + code);
  }
}

window.openScanner = () => {
  const modalEl = document.getElementById('scannerModal');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

async function startCamera() {
  try {
    if (html5QrCode) await html5QrCode.stop().catch(() => {});
    html5QrCode = new Html5Qrcode("reader");
    await html5QrCode.start(
      { facingMode: "environment" }, 
      { fps: 15, qrbox: { width: 250, height: 250 } },
      (text) => { 
        selectItemByBarcode(text); 
        bootstrap.Modal.getInstance(document.getElementById('scannerModal')).hide();
      }
    ).catch(e => {
        alert("ไม่สามารถเข้าถึงกล้องได้: " + e);
        bootstrap.Modal.getInstance(document.getElementById('scannerModal')).hide();
    });
  } catch (err) {
    console.error(err);
  }
}

window.closeScanner = async () => {
  if (html5QrCode) {
    await html5QrCode.stop().catch(() => {});
    html5QrCode.clear();
  }
};

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
  loadPageData();

  // Barcode input
  document.getElementById('barcode-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) { selectItemByBarcode(val); e.target.value = ''; }
    }
  });

  // Modal events
  document.getElementById('scannerModal')?.addEventListener('shown.bs.modal', startCamera);
  document.getElementById('scannerModal')?.addEventListener('hidden.bs.modal', window.closeScanner);

  // Form Submit: Create Loan
  document.getElementById('assign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-assignment');
    const fd = new FormData(e.target);
    const json = Object.fromEntries(fd.entries());
    json.equipmentIds = Array.from(document.querySelectorAll('.equip-check:checked')).map(cb => cb.value);

    if (json.equipmentIds.length === 0) {
      return alert('กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ');
    }

    try {
      btn.disabled = true; btn.innerHTML = '⌛ กำลังบันทึก...';
      await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(json) });
      bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
      window.layout?.showToast('สร้างใบเบิกอุปกรณ์เรียบร้อย', 'success');
      loadPageData();
      e.target.reset();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      btn.disabled = false; btn.innerHTML = '💾 บันทึกและสร้างใบเบิก';
    }
  });

  // Table Actions
  document.getElementById('assignments-list')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    
    if (e.target.classList.contains('btn-complete')) {
      if (!confirm('ยืนยันว่าได้รับของคืนครบถ้วน?')) return;
      try {
        await apiFetch('/api/assignments/' + id, { method: 'PUT', body: JSON.stringify({ status: 'Completed' }) });
        window.layout?.showToast('คืนอุปกรณ์เรียบร้อย', 'success');
        loadPageData();
      } catch(err) { alert('เกิดข้อผิดพลาด'); }
    }

    if (e.target.classList.contains('btn-edit-task')) {
      const d = e.target.dataset;
      document.getElementById('edit-assign-id').value = d.id;
      document.getElementById('edit-assign-desc').value = d.desc;
      document.getElementById('edit-assign-status').value = d.status;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('editAssignModal')).show();
    }
  });

  // Form Submit: Edit
  document.getElementById('edit-assign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const json = Object.fromEntries(fd.entries());
    delete json.id;

    try {
      await apiFetch('/api/assignments/' + id, { method: 'PUT', body: JSON.stringify(json) });
      bootstrap.Modal.getInstance(document.getElementById('editAssignModal')).hide();
      window.layout?.showToast('อัปเดตสถานะเรียบร้อย', 'success');
      loadPageData();
    } catch (err) {
      alert('แก้ไขไม่สำเร็จ');
    }
  });
});
