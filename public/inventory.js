// public/inventory.js
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

async function loadEquip() {
  const list = await apiFetch('/api/equipment');
  const tbody = document.getElementById('equip-table-body');
  tbody.innerHTML = '';

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">ยังไม่มีข้อมูลอุปกรณ์</td></tr>';
    return;
  }

  list.forEach(item => {
    const statusClass = 
      item.status === 'Available' ? 'badge bg-success' :
      item.status === 'In Use' ? 'badge bg-primary' :
      item.status === 'Maintenance' ? 'badge bg-warning text-dark' : 'badge bg-secondary';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold">${item.name}</td>
      <td>${item.category}</td>
      <td class="text-muted small">${item.serialNumber || '-'}</td>
      <td class="small font-monospace">${item.barcode || '-'}</td>
      <td><span class="${statusClass}">${item.status}</span></td>
      <td class="text-end">
        <div class="d-inline-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary btn-barcode" 
                  data-id="${item._id}" 
                  data-name="${item.name}" 
                  data-barcode="${item.barcode || item.serialNumber || item._id}">🖨️ บาร์โค้ด</button>
          <button class="btn btn-sm btn-outline-primary btn-edit" 
                  data-id="${item._id}" 
                  data-name="${item.name}" 
                  data-category="${item.category}" 
                  data-sn="${item.serialNumber || ''}" 
                  data-barcode="${item.barcode || ''}" 
                  data-status="${item.status}" 
                  data-note="${item.note || ''}">แก้ไข</button>
          <button class="btn btn-sm btn-outline-danger btn-del" data-id="${item._id}">ลบ</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Barcode Print Logic
window.printBarcode = () => {
  const content = document.getElementById('barcode-print-area').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Print Barcode</title>
        <style>
          body { text-align: center; font-family: sans-serif; padding: 20px; }
          svg { max-width: 100%; height: auto; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body onload="window.print();window.close()">
        ${content}
      </body>
    </html>
  `);
  win.document.close();
};

document.getElementById('add-equip-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const json = Object.fromEntries(fd.entries());
  
  // Explicitly set status to Available for new items
  json.status = 'Available';

  const res = await apiFetch('/api/equipment', {
    method: 'POST',
    body: JSON.stringify(json)
  });
  
  if (res) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addEquipModal')).hide();
    e.target.reset();
    loadEquip();
  }
});

document.getElementById('equip-table-body')?.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-barcode') || e.target.closest('.btn-barcode')) {
    const btn = e.target.classList.contains('btn-barcode') ? e.target : e.target.closest('.btn-barcode');
    const d = btn.dataset;
    document.getElementById('barcode-item-name').textContent = d.name;
    JsBarcode("#barcode-svg", d.barcode, {
      format: "CODE128",
      lineColor: "#000",
      width: 2,
      height: 60,
      displayValue: true
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('barcodeModal')).show();
    return;
  }

  if (e.target.classList.contains('btn-del')) {
    if (!confirm('ยืนยันการลบ?')) return;
    const id = e.target.dataset.id;
    await apiFetch('/api/equipment/' + id, { method: 'DELETE' });
    loadEquip();
  }

  if (e.target.classList.contains('btn-edit')) {
    const d = e.target.dataset;
    document.getElementById('edit-equip-id').value = d.id;
    document.getElementById('edit-equip-name').value = d.name;
    document.getElementById('edit-equip-category').value = d.category;
    document.getElementById('edit-equip-serialNumber').value = d.sn;
    document.getElementById('edit-equip-barcode').value = d.barcode;
    document.getElementById('edit-equip-status').value = d.status;
    document.getElementById('edit-equip-note').value = d.note;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editEquipModal')).show();
  }
});

document.getElementById('edit-equip-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const json = Object.fromEntries(fd.entries());
  delete json.id;

  const res = await apiFetch('/api/equipment/' + id, {
    method: 'PUT',
    body: JSON.stringify(json)
  });

  if (res) {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('editEquipModal')).hide();
    loadEquip();
  } else {
    alert('บันทึกการแก้ไขไม่สำเร็จ');
  }
});

document.addEventListener('DOMContentLoaded', loadEquip);
