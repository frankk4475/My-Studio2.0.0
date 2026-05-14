/* =============== Utils =============== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const money = (n) => (Number(n)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = (d) => { if(!d) return '-'; const x = new Date(d); return isNaN(x)?'-':x.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'2-digit'}); };
const qparam = (k) => new URLSearchParams(location.search).get(k);

function token(){ return sessionStorage.getItem('authToken'); }

async function apiGet(path,{allow404=false, publicPath=null}={}){
  const t = token();
  const headers = { Accept:'application/json' };
  if (t) headers.Authorization = 'Bearer '+t;

  let r = await fetch(path,{ headers });
  
  // If unauthorized and a public path is provided, try public path
  if ((r.status === 401 || r.status === 403) && publicPath) {
    console.log('🔓 Authenticated access failed, trying public path...');
    r = await fetch(publicPath, { headers: { Accept: 'application/json' } });
  }

  const ct = r.headers.get('content-type')||'';
  const body = ct.includes('json')? await r.json().catch(()=>null): await r.text().catch(()=>null);
  
  if (!r.ok) {
      if (allow404 && r.status === 404) return null;
      throw new Error(typeof body==='string'? body : (body?.message||'Request failed'));
  }
  return body;
}

/* =============== Seller (settings) =============== */
function renderSeller(s={}){
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
  $('brand-taxid')   && ($('brand-taxid').textContent   = biz.taxId   || '-');

  // seller box
  $('seller-name')   && ($('seller-name').textContent   = biz.name    || '-');
  $('seller-addr')   && ($('seller-addr').textContent   = biz.address || '-');
  $('seller-phone')  && ($('seller-phone').textContent  = biz.phone   || '-');
  $('seller-email')  && ($('seller-email').textContent  = biz.email   || '-');
  $('seller-taxid')  && ($('seller-taxid').textContent  = biz.taxId   || '-');
}

/* =============== Render Quote =============== */
function renderQuote(q){
  const qNo = q.quoteNumber || `Q-${String(q._id||'').slice(-6).toUpperCase()}`;
  $('doc-no')       && ($('doc-no').textContent       = qNo);
  $('meta-number')  && ($('meta-number').textContent  = qNo);
  $('meta-issue')   && ($('meta-issue').textContent   = fmtDate(q.createdAt));
  $('meta-term')    && ($('meta-term').textContent    = q.creditTerm ? `${q.creditTerm} วัน` : '30 วัน');
  $('meta-project') && ($('meta-project').textContent = q.projectName || '-');
  $('meta-contact') && ($('meta-contact').textContent = q.contactName || '-');
  $('meta-status')  && ($('meta-status').textContent  = q.status || 'Draft');
  $('meta-ref')     && ($('meta-ref').textContent     = q.referenceNumber || q.reference || '-');

  $('buyer-name') && ($('buyer-name').textContent = q.customerName || q.customer || '-');
  $('buyer-tax')  && ($('buyer-tax').textContent  = q.customerTaxId || '-');
  $('buyer-addr') && ($('buyer-addr').textContent = q.customerAddress || '-');

  const tbody = $('items-body');
  const items = Array.isArray(q.items) ? q.items : [];
  if (tbody){
    if (!items.length){
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">ไม่มีรายการ</td></tr>`;
    }else{
      tbody.innerHTML = items.map((it,i)=>{
        const qty = Number(it.quantity)||0, price = Number(it.price)||0;
        return `<tr>
          <td>${i+1}</td>
          <td>${esc(it.description||'-')}</td>
          <td class="text-end">${qty.toLocaleString('th-TH')}</td>
          <td class="text-end">${money(price)}</td>
          <td class="text-end">${money(qty*price)}</td>
        </tr>`;
      }).join('');
    }
  }

  const subtotal = items.reduce((s,it)=> s+(Number(it.quantity)||0)*(Number(it.price)||0),0);
  const discount = Number(q.specialDiscount || q.discount || 0);
  const grand    = Math.max(subtotal - discount, 0);
  $('sum-sub')   && ($('sum-sub').textContent   = money(subtotal));
  $('sum-disc')  && ($('sum-disc').textContent  = money(discount));
  $('sum-grand') && ($('sum-grand').textContent = money(grand));

  if (q.requiredDeposit > 0) {
      if ($('deposit-row')) $('deposit-row').style.display = 'flex';
      if ($('sum-deposit')) $('sum-deposit').textContent = money(q.requiredDeposit);
  }
}

/* =============== Boot =============== */
document.addEventListener('DOMContentLoaded', async () => {
  try{
    const id = qparam('id');
    if (!id){ 
      document.body.innerHTML = `<div class="sheet"><h3>เกิดข้อผิดพลาด: ไม่พบรหัสเอกสาร</h3></div>`; 
      return; 
    }

    // 1. Load Settings
    const settings = await apiGet('/api/settings', {allow404:true, publicPath:'/api/settings/public'}) || {};
    renderSeller(settings);

    // 2. Load Quote
    const q = await apiGet('/api/quotes/' + encodeURIComponent(id), { publicPath:`/api/quotes/${id}/public` });
    renderQuote(q);

    // 3. Handle Admin-only actions
    const hasToken = !!token();
    const convertBtn = $('convert-btn');
    const backBtn = $('back-to-list');

    if (!hasToken) {
        if (convertBtn) convertBtn.style.display = 'none';
        if (backBtn) backBtn.classList.add('d-none');
    } else {
        if (backBtn) backBtn.classList.remove('d-none');
        if (convertBtn) {
            convertBtn.addEventListener('click', async () => {
          try{
            convertBtn.disabled = true; 
            const originalText = convertBtn.textContent;
            convertBtn.textContent = 'กำลังแปลง...';
            
            const r = await fetch('/api/quotes/' + encodeURIComponent(id), {
              method:'PUT',
              headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token() },
              body: JSON.stringify({ status:'Accepted' })
            });
            
            if (r.status === 401 || r.status === 403) {
              location.replace('/login.html?reason=expired');
              return;
            }
            
            const body = await r.json().catch(()=>null);
            if (!r.ok) throw new Error(body?.message || 'แปลงเป็นใบแจ้งหนี้ไม่สำเร็จ');
            
            const invId = body?.createdInvoiceId;
            if (invId) location.href = `/billing-detail.html?id=${invId}`;
            else alert('อัปเดตสถานะเป็น Accepted แล้ว');
            
          }catch(err){ 
            alert(err.message || 'แปลงเป็นใบแจ้งหนี้ไม่สำเร็จ'); 
          }finally{ 
            convertBtn.disabled = false; 
            convertBtn.textContent = 'แปลงเป็นใบแจ้งหนี้'; 
          }
        });
      }
    }

  }catch(err){
    console.error(err);
    document.body.innerHTML = `<div class="sheet"><h3>เกิดข้อผิดพลาด: ${esc(err.message||'โหลดข้อมูลไม่สำเร็จ')}</h3></div>`;
  }
});
