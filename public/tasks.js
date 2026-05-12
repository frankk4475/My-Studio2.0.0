// public/tasks.js

/**
 * UTILS & AUTH
 */
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

/**
 * STATE
 */
let allEquipment = [];
let html5QrCode = null;

/**
 * CORE LOGIC: DATA LOADING
 */
async function loadPageData() {
  const spinner = document.getElementById('loading-spinner');
  const errorAlert = document.getElementById('error-alert');
  const listContainer = document.getElementById('assignments-list');

  try {
    // Show spinner, hide list
    spinner?.classList.remove('d-none');
    listContainer?.classList.add('d-none');
    errorAlert?.classList.add('d-none');

    // Load everything in parallel
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
    
    // 2. Render Assignments
    renderAssignments(assignments);

    // Show list, hide spinner
    spinner?.classList.add('d-none');
    listContainer?.classList.remove('d-none');

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

  // Fill Bookings
  if (bSelect) {
    bSelect.innerHTML = '<option value="">-- เลือกรายการจอง --</option>';
    bookings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b._id;
      opt.textContent = `${b.customer} - ${new Date(b.date).toLocaleDateString('th-TH')} (${b.bookingType})`;
      bSelect.appendChild(opt);
    });
  }

  // Fill Employees
  if (eSelect) {
    eSelect.innerHTML = '<option value="">-- เลือกพนักงาน --</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u._id;
      opt.textContent = `${u.displayName || u.username} (${u.jobTitle || 'พนักงาน'})`;
      eSelect.appendChild(opt);
    });
  }

  // Fill Equipment Checkboxes
  if (equipBox) {
    equipBox.innerHTML = '';
    const available = equipment.filter(e => e.status === 'Available');
    if (available.length === 0) {
      equipBox.innerHTML = '<div class="col-12 text-center py-2 text-muted small">ไม่มีอุปกรณ์ว่าง</div>';
    } else {
      available.forEach(e => {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4 mb-2';
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
  const container = document.getElementById('assignments-list');
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="col-12 text-center py-5 text-muted">ยังไม่มีประวัติการเบิกของ</div>';
    return;
  }

  list.forEach(item => {
    const equipList = (item.equipmentIds || []).map(e => `<li>${e.name} <small class="text-muted">(${e.serialNumber || '-'})</small></li>`).join('');
    
    let statusBadge = '';
    if (item.status === 'Completed') statusBadge = '<span class="badge bg-success">คืนของเรียบร้อย</span>';
    else if (item.status === 'In Progress') statusBadge = '<span class="badge bg-primary">กำลังใช้งาน</span>';
    else statusBadge = '<span class="badge bg-warning text-dark">รอดำเนินการ</span>';

    const card = document.createElement('div');
    card.className = 'col-md-6 col-lg-4';
    card.innerHTML = `
      <div class="card h-100 shadow-sm border-0">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            ${statusBadge}
            <small class="text-muted font-monospace">${item.documentNumber || '-'}</small>
          </div>
          <h6 class="fw-bold mb-1">${item.bookingId?.customer || 'ไม่พบข้อมูลลูกค้า'}</h6>
          <div class="small text-muted mb-3">${new Date(item.assignedAt).toLocaleDateString('th-TH')} | ${item.bookingId?.bookingType || '-'}</div>
          
          <div class="mb-2">
            <small class="d-block fw-bold text-secondary text-uppercase" style="font-size:0.65rem">ผู้เบิกอุปกรณ์</small>
            <span>${item.employeeId?.displayName || item.employeeId?.username || 'N/A'}</span>
          </div>

          <div class="mb-3">
            <small class="d-block fw-bold text-secondary text-uppercase" style="font-size:0.65rem">อุปกรณ์ที่เบิก (${item.equipmentIds?.length || 0})</small>
            <ul class="small mb-0 ps-3 mt-1">${equipList || '<li class="text-muted">ไม่ได้ระบุอุปกรณ์</li>'}</ul>
          </div>

          <div class="d-flex gap-2 mt-auto pt-2 border-top">
            <a href="/loan-detail.html?id=${item._id}" class="btn btn-sm btn-light flex-grow-1">🖨️ พิมพ์ใบเบิก</a>
            ${item.status !== 'Completed' ? `
              <button class="btn btn-sm btn-success btn-complete" data-id="${item._id}">ยืนยันคืนของ</button>
              <button class="btn btn-sm btn-outline-primary btn-edit-task" data-id="${item._id}" data-desc="${item.taskDescription || ''}" data-status="${item.status}">✏️</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
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
  if (!found) alert('❌ ไม่พบอุปกรณ์ที่มีรหัส: ' + code);
}

window.openScanner = () => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    alert('⚠️ Security: Camera access requires HTTPS');
    return;
  }
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
      (text) => { selectItemByBarcode(text); window.closeScanner(); }
    );
  } catch (err) {
    alert("ไม่สามารถเปิดกล้องได้: " + err.message);
    window.closeScanner();
  }
}

window.closeScanner = async () => {
  if (html5QrCode) {
    await html5QrCode.stop().catch(() => {});
    html5QrCode.clear();
  }
  bootstrap.Modal.getInstance(document.getElementById('scannerModal'))?.hide();
};

/**
 * EVENT HANDLERS
 */
document.addEventListener('DOMContentLoaded', () => {
  loadPageData();

  // Barcode input (Enter key)
  document.getElementById('barcode-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) { selectItemByBarcode(val); e.target.value = ''; }
    }
  });

  // Modal events
  const scanModal = document.getElementById('scannerModal');
  scanModal?.addEventListener('shown.bs.modal', startCamera);
  scanModal?.addEventListener('hidden.bs.modal', window.closeScanner);

  // Form Submit: Create Loan
  document.getElementById('assign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-assignment');
    const fd = new FormData(e.target);
    const json = Object.fromEntries(fd.entries());
    json.equipmentIds = Array.from(document.querySelectorAll('.equip-check:checked')).map(cb => cb.value);

    try {
      btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
      await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(json) });
      bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
      e.target.reset();
      loadPageData();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกและสร้างใบเบิก';
    }
  });

  // List Actions (Complete/Edit)
  document.getElementById('assignments-list')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    
    if (e.target.classList.contains('btn-complete')) {
      if (!confirm('ยืนยันว่าได้รับของคืนครบถ้วน?')) return;
      await apiFetch('/api/assignments/' + id, { method: 'PUT', body: JSON.stringify({ status: 'Completed' }) });
      loadPageData();
    }

    if (e.target.classList.contains('btn-edit-task')) {
      const d = e.target.dataset;
      document.getElementById('edit-assign-id').value = d.id;
      document.getElementById('edit-assign-desc').value = d.desc;
      document.getElementById('edit-assign-status').value = d.status;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('editAssignModal')).show();
    }
  });

  // Form Submit: Edit Status
  document.getElementById('edit-assign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    const json = Object.fromEntries(fd.entries());
    delete json.id;

    try {
      await apiFetch('/api/assignments/' + id, { method: 'PUT', body: JSON.stringify(json) });
      bootstrap.Modal.getInstance(document.getElementById('editAssignModal')).hide();
      loadPageData();
    } catch (err) {
      alert('แก้ไขไม่สำเร็จ');
    }
  });
});
