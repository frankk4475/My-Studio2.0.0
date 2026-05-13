// public/settings.js — Categorized Settings Management

async function loadSettings() {
  const token = sessionStorage.getItem('authToken');
  try {
    const res = await fetch('/api/settings', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // 1. Business Profile
    const b = data.business || {};
    const fBusiness = document.getElementById('form-business');
    fBusiness.elements['name'].value = b.name || '';
    fBusiness.elements['address'].value = b.address || '';
    fBusiness.elements['phone'].value = b.phone || '';
    fBusiness.elements['email'].value = b.email || '';
    fBusiness.elements['taxId'].value = b.taxId || '';
    if (b.logoUrl) {
      document.getElementById('logo-preview').src = b.logoUrl + '?t=' + Date.now();
    }

    // 2. Document & Tax
    const d = data.doc || {};
    const t = data.tax || {};
    const fDoc = document.getElementById('form-doc');
    fDoc.elements['creditTermDays'].value = d.creditTermDays || 30;
    fDoc.elements['footerNote'].value = d.footerNote || '';
    fDoc.elements['useVat'].checked = t.useVat || false;
    fDoc.elements['vatRate'].value = t.vatRate || 7;
    fDoc.elements['pricesIncludeVat'].checked = t.pricesIncludeVat || false;
    
    // Toggle VAT details visibility
    toggleVatDetails(t.useVat);

    // 3. API Integrations
    const api = data.apiKeys || {};
    const fApi = document.getElementById('form-api');
    fApi.elements['ollamaUrl'].value = api.ollamaUrl || 'http://localhost:11434';
    fApi.elements['ollamaModel'].value = api.ollamaModel || 'llama3';
    fApi.elements['lineCustomerAccessToken'].value = api.lineCustomerAccessToken || '';
    fApi.elements['lineCustomerSecret'].value = api.lineCustomerSecret || '';
    fApi.elements['lineAdminAccessToken'].value = api.lineAdminAccessToken || '';
    fApi.elements['lineAdminSecret'].value = api.lineAdminSecret || '';

  } catch (err) {
    console.error('Failed to load settings:', err);
    if (window.layout) window.layout.showToast('โหลดการตั้งค่าไม่สำเร็จ', 'error');
  }
}

function toggleVatDetails(show) {
  const details = document.getElementById('vat-details');
  if (show) details.classList.remove('d-none');
  else details.classList.add('d-none');
}

async function saveSection(sectionName, payload) {
  const token = sessionStorage.getItem('authToken');
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (window.layout) window.layout.showToast(`บันทึก${sectionName}เรียบร้อย`, 'success');
      loadSettings();
    } else {
      const data = await res.json();
      alert('บันทึกไม่สำเร็จ: ' + data.message);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // VAT Toggle event
  document.getElementById('useVat')?.addEventListener('change', (e) => {
    toggleVatDetails(e.target.checked);
  });

  // Logo Upload
  document.getElementById('logo-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const token = sessionStorage.getItem('authToken');
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        document.getElementById('logo-preview').src = data.url + '?t=' + Date.now();
        if (window.layout) window.layout.showToast('อัปโหลดโลโก้สำเร็จ', 'success');
      } else {
        alert('อัปโหลดไม่สำเร็จ: ' + data.message);
      }
    } catch (err) { alert('เกิดข้อผิดพลาดในการอัปโหลด'); }
  });

  // Forms Submission
  document.getElementById('form-business')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const business = Object.fromEntries(fd.entries());
    saveSection('ข้อมูลธุรกิจ', { business });
  });

  document.getElementById('form-doc')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const payload = {
      doc: {
        creditTermDays: Number(data.creditTermDays),
        footerNote: data.footerNote
      },
      tax: {
        useVat: e.target.elements['useVat'].checked,
        vatRate: Number(data.vatRate),
        pricesIncludeVat: e.target.elements['pricesIncludeVat'].checked
      }
    };
    saveSection('การตั้งค่าเอกสาร', payload);
  });

  document.getElementById('form-api')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const apiKeys = Object.fromEntries(fd.entries());
    saveSection('API Keys', { apiKeys });
  });
});
