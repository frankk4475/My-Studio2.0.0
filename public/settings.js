// public/settings.js
(() => {
  const $ = (id) => document.getElementById(id);

  function needAuth() {
    const t = sessionStorage.getItem('authToken');
    if (!t) { console.warn('No auth token found'); location.replace('/login.html'); return null; }
    return t;
  }

  function setLogoPreview(url) {
    const img = $('logo-preview');
    if (!img) return;
    img.src = url || '';
    if (!url) img.style.display = 'none'; else img.style.display = 'block';
  }

  function fillForm(s) {
    console.log('Filling form with settings:', s);
    if (!s) return;

    const biz = s.business || {};
    const doc = s.doc || {};
    const tax = s.tax || {};
    const api = s.apiKeys || {};

    if ($('biz-name')) $('biz-name').value = biz.name || '';
    if ($('biz-address')) $('biz-address').value = biz.address || '';
    if ($('biz-phone')) $('biz-phone').value = biz.phone || '';
    if ($('biz-email')) $('biz-email').value = biz.email || '';
    if ($('biz-taxid')) $('biz-taxid').value = biz.taxId || '';
    if ($('biz-logo-url')) $('biz-logo-url').value = biz.logoUrl || '';
    setLogoPreview(biz.logoUrl);

    if ($('doc-credit')) $('doc-credit').value = doc.creditTermDays ?? 30;
    if ($('doc-footer')) $('doc-footer').value = doc.footerNote || '';

    if ($('tax-use')) $('tax-use').checked = !!tax.useVat;
    if ($('tax-rate')) $('tax-rate').value = tax.vatRate ?? 7;
    if ($('tax-inc')) $('tax-inc').checked = !!tax.pricesIncludeVat;

    // API Keys
    if ($('api-line-token')) $('api-line-token').value = api.lineCustomerAccessToken || '';
    if ($('api-line-secret')) $('api-line-secret').value = api.lineCustomerSecret || '';
    if ($('api-line-admin-token')) $('api-line-admin-token').value = api.lineAdminAccessToken || '';
    if ($('api-line-admin-secret')) $('api-line-admin-secret').value = api.lineAdminSecret || '';
    if ($('api-gemini-key')) $('api-gemini-key').value = api.geminiApiKey || '';
  }

  async function loadSettings() {
    const token = needAuth(); if (!token) return;
    try {
      console.log('Loading settings from API...');
      const res = await fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('โหลดค่าตั้งค่าไม่สำเร็จ (' + res.status + ')');
      const s = await res.json();
      console.log('Settings loaded:', s);
      sessionStorage.setItem('settingsCache', JSON.stringify({ ts: Date.now(), data: s }));
      fillForm(s);
    } catch (err) {
      console.error('Load settings error:', err);
      alert(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const token = needAuth(); if (!token) return;

    const btn = $('settings-save-btn');
    if (btn) { btn.disabled = true; btn.dataset._old = btn.innerText; btn.innerText = 'กำลังบันทึก...'; }

    try {
      const body = {
        business: {
          name:    $('biz-name')?.value.trim() || '',
          address: $('biz-address')?.value.trim() || '',
          phone:   $('biz-phone')?.value.trim() || '',
          email:   $('biz-email')?.value.trim() || '',
          taxId:   $('biz-taxid')?.value.trim() || '',
          logoUrl: $('biz-logo-url')?.value.trim() || '',
        },
        doc: {
          creditTermDays: Number($('doc-credit')?.value || 30),
          footerNote:     $('doc-footer')?.value.trim() || '',
        },
        tax: {
          useVat:           !!$('tax-use')?.checked,
          vatRate:          Number($('tax-rate')?.value || 7),
          pricesIncludeVat: !!$('tax-inc')?.checked,
        },
        apiKeys: {
          lineCustomerAccessToken: $('api-line-token')?.value.trim() || '',
          lineCustomerSecret:      $('api-line-secret')?.value.trim() || '',
          lineAdminAccessToken:    $('api-line-admin-token')?.value.trim() || '',
          lineAdminSecret:         $('api-line-admin-secret')?.value.trim() || '',
          geminiApiKey:           $('api-gemini-key')?.value.trim() || '',
        }
      };

      console.log('Saving settings:', body);

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'บันทึกไม่สำเร็จ');
      }
      
      const saved = await res.json();
      console.log('Settings saved result:', saved);
      sessionStorage.setItem('settingsCache', JSON.stringify({ ts: Date.now(), data: saved }));
      fillForm(saved);
      alert('บันทึกการตั้งค่าทั้งหมดเรียบร้อยแล้ว ✔︎ กรุณา Restart Server เพื่อให้ค่า API ใหม่มีผล');
    } catch (err) {
      console.error('Save settings error:', err);
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = btn.dataset._old || '💾 บันทึกการตั้งค่าทั้งหมด'; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    loadSettings();

    // Event listeners
    $('biz-logo-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
            const res = await fetch('/api/settings/logo', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('authToken') },
                body: formData
            });
            const data = await res.json();
            if (data.ok) {
                $('biz-logo-url').value = data.url;
                setLogoPreview(data.url);
            }
        } catch (err) {
            console.error('Logo upload error:', err);
        }
    });

    $('settings-form')?.addEventListener('submit', saveSettings);
  });
})();
