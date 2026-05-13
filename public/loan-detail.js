// public/loan-detail.js
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fmtDate = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  return isNaN(x) ? '-' : x.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'2-digit'});
};
const getParam = (k) => new URLSearchParams(location.search).get(k);

function token() {
  return sessionStorage.getItem('authToken');
}

async function apiGet(path, {allow404=false, publicPath=null} = {}) {
  const t = token();
  const headers = { Accept:'application/json' };
  if (t) headers.Authorization = 'Bearer '+t;

  let r = await fetch(path,{ headers });
  
  if ((r.status === 401 || r.status === 403) && publicPath) {
    console.log('🔓 Public access mode');
    r = await fetch(publicPath, { headers: { Accept: 'application/json' } });
  }

  const ct = r.headers.get('content-type')||'';
  const body = ct.includes('json') ? await r.json().catch(()=>null) : await r.text().catch(()=>null);
  
  if (r.status===404 && allow404) return null;
  if (!r.ok) throw new Error(typeof body==='string'? body : (body?.message||'Request failed'));
  return body;
}

function applyBrand(settings) {
  const biz = settings?.business || {};
  $('brand-logo').src = biz.logoUrl || '';
  $('brand-name').textContent = biz.name || 'Studio Admin';
  $('brand-address').textContent = biz.address || '-';
  const contact = [];
  if (biz.phone) contact.push(`Tel: ${biz.phone}`);
  if (biz.email) contact.push(biz.email);
  $('brand-contact').textContent = contact.join(' · ') || '-';
}

function renderLoan(data) {
  const docNo = data.documentNumber || '-';
  $('doc-no').textContent = docNo;
  $('meta-number').textContent = docNo;
  $('meta-date').textContent = fmtDate(data.assignedAt);
  $('meta-desc').textContent = data.taskDescription || '-';
  
  // Employee
  $('emp-name').textContent = data.employeeId?.displayName || data.employeeId?.username || '-';
  $('emp-title').textContent = data.employeeId?.jobTitle || '-';
  $('emp-sign-name').textContent = data.employeeId?.displayName || data.employeeId?.username || '................................................';

  // Booking
  $('booking-cust').textContent = data.bookingId?.customer || '-';
  $('booking-date').textContent = fmtDate(data.bookingId?.date);

  // Equipment Table
  const tbody = $('items-body');
  const items = data.equipmentIds || [];
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">ไม่มีรายการอุปกรณ์ที่เบิก</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((it, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${esc(it.name)}</td>
      <td>${esc(it.category)}</td>
      <td>${esc(it.serialNumber || '-')}</td>
      <td class="font-monospace" style="font-size: 0.85rem">${esc(it.barcode || '-')}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const id = getParam('id');
  if (!id) { 
    if (token()) location.replace('/tasks.html');
    else document.body.innerHTML = '<div class="container py-5"><h3>ไม่พบรหัสใบเบิกอุปกรณ์</h3></div>';
    return; 
  }

  try {
    const [settings, target] = await Promise.all([
      apiGet('/api/settings', {allow404:true, publicPath:'/api/settings/public'}),
      apiGet('/api/assignments/' + id, { publicPath: `/api/assignments/${id}/public` })
    ]);

    if (settings) applyBrand(settings);
    
    if (target) {
      renderLoan(target);
    } else {
      throw new Error('ไม่พบข้อมูลใบเบิกที่ระบุ');
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});
