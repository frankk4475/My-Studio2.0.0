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
const q = (k) => new URLSearchParams(location.search).get(k);

function token() {
  const t = sessionStorage.getItem('authToken');
  if (!t) { location.replace('/login.html'); throw new Error('no token'); }
  return t;
}
async function apiGet(path, {allow404=false} = {}){
  const r = await fetch(path,{ headers:{ Accept:'application/json', Authorization:'Bearer '+token() }});
  const ct = r.headers.get('content-type')||'';
  const body = ct.includes('json') ? await r.json().catch(()=>null) : await r.text().catch(()=>null);
  if (r.status===401||r.status===403){ location.replace('/login.html?reason=expired'); throw new Error('unauthorized'); }
  if (r.status===404 && allow404) return null;
  if (!r.ok) throw new Error(typeof body==='string'? body : (body?.message||'Request failed'));
  return body;
}

/* =============== Brand/Settings =============== */
function applyBrand(s={}){
  const biz = s.business || {};
  // โลโก้
  const img = $('brand-logo');
  if (img) img.src = biz.logoUrl || '';

  // header (brand)
  $('brand-name')    && ($('brand-name').textContent    = biz.name    || 'Your Studio Name');
  $('brand-address') && ($('brand-address').textContent = biz.address || '123 Main Street, City, Country');

  const contact = [];
  if (biz.phone) contact.push(`Tel: ${biz.phone}`);
  if (biz.email) contact.push(biz.email);
  $('brand-contact') && ($('brand-contact').textContent = contact.join(' · ') || 'Tel: (123) 456-7890 · info@yourstudio.com');
  $('brand-taxid')   && ($('brand-taxid').textContent   = biz.taxId || '-');

  // seller box
  $('seller-name')   && ($('seller-name').textContent   = biz.name    || '-');
  $('seller-addr')   && ($('seller-addr').textContent   = biz.address || '-');
  $('seller-phone')  && ($('seller-phone').textContent  = biz.phone   || '-');
  $('seller-email')  && ($('seller-email').textContent  = biz.email   || '-');
  $('seller-taxid')  && ($('seller-taxid').textContent  = biz.taxId   || '-');
}

/* =============== Render invoice =============== */
function renderInvoice(inv){
  const number = inv.invoiceNumber || `INV-${String(inv._id||'').slice(-6).toUpperCase()}`;

  // buyer (คัดลอกจาก invoice)
  $('buyer-name')    && ($('buyer-name').textContent    = inv.customerName    || '-');
  $('buyer-tax')     && ($('buyer-tax').textContent     = inv.customerTaxId   || '-');
  $('buyer-addr')    && ($('buyer-addr').textContent    = inv.customerAddress || '-');
  $('buyer-contact') && ($('buyer-contact').textContent = inv.contactName     || '-');

  // meta
  $('doc-no')      && ($('doc-no').textContent      = number);
  $('meta-number') && ($('meta-number').textContent = number);
  $('meta-issue')  && ($('meta-issue').textContent  = fmtDate(inv.issueDate || inv.createdAt));
  $('meta-due')    && ($('meta-due').textContent    = fmtDate(inv.dueDate));
  // แสดงเลขใบเสนอราคาที่อ้างอิง
  const ref = inv.refQuoteNumber || inv.refQuoteId || '-';
  $('meta-ref')    && ($('meta-ref').textContent    = ref);

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
            <td class="num">${qty.toLocaleString('th-TH')}</td>
            <td class="num">${money(price)}</td>
            <td class="num">${money(qty*price)}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="5" class="text-center text-muted">ไม่มีรายการ</td></tr>`;
  }

  // totals
  const subtotal = Number(inv.amount) || items.reduce((s,it)=>s+(Number(it.quantity)||0)*(Number(it.price)||0),0);
  const discount = Number(inv.discount)||0;
  const grand    = Number(inv.grandTotal) || Math.max(0, subtotal - Math.max(0,discount));
  $('sum-sub')   && ($('sum-sub').textContent   = money(subtotal));
  $('sum-disc')  && ($('sum-disc').textContent  = money(discount));
  $('sum-grand') && ($('sum-grand').textContent = money(grand));
}


/* =============== Boot =============== */
document.addEventListener('DOMContentLoaded', async () => {
  try{
    const id = q('id');
    if (!id){ location.replace('/invoices.html'); return; }

    // 1) settings (ยอม 404) + เติมแบรนด์/โลโก้
    const settings = await apiGet('/api/settings', {allow404:true}) || {};
    applyBrand(settings);

    // 2) invoice
    const inv = await apiGet('/api/invoices/' + encodeURIComponent(id));
    renderInvoice(inv);

  }catch(err){
    console.error(err);
    const tbody = $('items-body');
    if (tbody){
      tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">${esc(err.message||'โหลดข้อมูลไม่สำเร็จ')}</td></tr>`;
    }else{
      document.body.innerHTML = `<div class="container py-5"><h3 class="text-danger">${esc(err.message||'Error')}</h3></div>`;
    }
  }
});
