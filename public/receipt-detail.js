/* =============== Utils =============== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const money = (n) => (Number(n)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});

const fmtDate = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  return isNaN(x) ? '-' : x.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'2-digit'});
};

const getParam = (k) => new URLSearchParams(location.search).get(k);

function token() {
  return sessionStorage.getItem('authToken');
}

async function apiGet(path, {allow404=false, publicPath=null} = {}){
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

/* =============== Brand/Settings =============== */
function applyBrand(s={}){
  const biz = s.business || {};
  const img = $('brand-logo');
  if (img) img.src = biz.logoUrl || '';

  const setEl = (id, val) => { const el = $(id); if(el) el.textContent = val; };

  setEl('brand-name', biz.name || 'Your Studio Name');
  setEl('brand-address', biz.address || '123 Main Street, City, Country');
  
  const contact = [];
  if (biz.phone) contact.push(`Tel: ${biz.phone}`);
  if (biz.email) contact.push(biz.email);
  setEl('brand-contact', contact.join(' · ') || 'Tel: (123) 456-7890 · info@yourstudio.com');
  setEl('brand-taxid', biz.taxId || '-');

  // seller box
  setEl('seller-name', biz.name || '-');
  setEl('seller-addr', biz.address || '-');
  setEl('seller-phone', biz.phone || '-');
  setEl('seller-email', biz.email || '-');
  setEl('seller-taxid', biz.taxId || '-');
}

/* =============== Render Receipt =============== */
function renderReceipt(inv){
  const invNo = inv.invoiceNumber || '-';
  const recNo = invNo.startsWith('INV') ? invNo.replace('INV', 'REC') : `REC-${invNo}`;

  const setEl = (id, val) => { const el = $(id); if(el) el.textContent = val; };

  // buyer
  setEl('buyer-name', inv.customerName || '-');
  setEl('buyer-tax', inv.customerTaxId || '-');
  setEl('buyer-addr', inv.customerAddress || '-');
  setEl('buyer-contact', inv.contactName || '-');

  // meta
  setEl('doc-no', recNo);
  setEl('meta-number', recNo);
  // วันที่รับชำระ - ถ้ามี amountPaid และเป็น Paid อาจจะใช้วันที่อัปเดตล่าสุด หรือวันนี้
  setEl('meta-date', fmtDate(inv.updatedAt || new Date())); 
  setEl('meta-ref', invNo);

  // items
  const tbody = $('items-body');
  const items = Array.isArray(inv.items) ? inv.items : [];
  if (tbody){
    tbody.innerHTML = items.length
      ? items.map((it,i)=>{
          const qty = Number(it.quantity)||0, price = Number(it.price)||0;
          return `<tr>
            <td class="text-center">${i+1}</td>
            <td>${esc(it.description||'-')}</td>
            <td class="text-end">${qty.toLocaleString('th-TH')}</td>
            <td class="text-end">${money(price)}</td>
            <td class="text-end">${money(qty*price)}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="5" class="text-center text-muted">ไม่มีรายการ</td></tr>`;
  }

  // totals
  const subtotal = Number(inv.amount) || items.reduce((s,it)=>s+(Number(it.quantity)||0)*(Number(it.price)||0),0);
  const discount = Number(inv.discount)||0;
  const grand    = Number(inv.grandTotal) || Math.max(0, subtotal - Math.max(0,discount));
  
  setEl('sum-sub', money(subtotal));
  setEl('sum-disc', money(discount));
  // ถ้าจ่ายแล้วแต่ amountPaid ยังเป็น 0 (อาจจะติ๊กถูกเอง) ให้แสดงยอดเต็ม
  const displayTotal = (inv.paymentStatus === 'Paid' && (inv.amountPaid || 0) === 0) ? grand : (inv.amountPaid || grand);
  setEl('sum-grand', money(displayTotal));
}

/* =============== Boot =============== */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const id = getParam('id');
    if (!id) { 
      const tbody = $('items-body');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">ไม่พบรหัสเอกสาร (Missing ID)</td></tr>`;
      return; 
    }

    const [inv, settings] = await Promise.all([
      apiGet('/api/invoices/' + encodeURIComponent(id), { publicPath: `/api/invoices/${id}/public` }),
      apiGet('/api/settings', {allow404:true, publicPath:'/api/settings/public'})
    ]);

    if (settings) applyBrand(settings);
    if (inv) renderReceipt(inv);

  } catch (err) {
    console.error(err);
    const tbody = $('items-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">${esc(err.message||'โหลดข้อมูลไม่สำเร็จ')}</td></tr>`;
    }
  }
});
