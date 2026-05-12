// public/settings.js
(() => {
  const $ = (id) => document.getElementById(id);

  function needAuth() {
    const t = sessionStorage.getItem('authToken');
    if (!t) { location.replace('/login.html'); return null; }
    return t;
  }

  function setLogoPreview(url) {
    const img = $('logo-preview');
    if (!img) return;
    img.src = url || '';
  }

  function fillForm(s) {
    const biz = s?.business || {};
    const doc = s?.doc || {};
    const tax = s?.tax || {};

    $('biz-name').value     = biz.name    || '';
    $('biz-address').value  = biz.address || '';
    $('biz-phone').value    = biz.phone   || '';
    $('biz-email').value    = biz.email   || '';
    $('biz-taxid').value    = biz.taxId   || '';
    $('biz-logo-url').value = biz.logoUrl || '';
    setLogoPreview(biz.logoUrl || '');

    $('doc-credit').value   = doc.creditTermDays ?? 30;
    $('doc-footer').value   = doc.footerNote || '';

    $('tax-use').checked    = !!tax.useVat;
    $('tax-rate').value     = tax.vatRate ?? 7;
    $('tax-inc').checked    = !!tax.pricesIncludeVat;
  }

  async function loadSettings() {
    const token = needAuth(); if (!token) return;
    try {
      const res = await fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401 || res.status === 403) {
        location.replace('/login.html?reason=expired');
        return;
      }
      if (!res.ok) throw new Error('โหลดค่าตั้งค่าไม่สำเร็จ');
      const s = await res.json();
      sessionStorage.setItem('settingsCache', JSON.stringify({ ts: Date.now(), data: s }));
      fillForm(s);
    } catch (err) {
      console.error(err);
      alert(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    const token = needAuth(); if (!token) return;

    // ถ้าเลือกไฟล์ ให้แปลงเป็น dataURL เก็บใน logoUrl
    async function fileToDataURL(file) {
      if (!file) return null;
      if (file.size > 850 * 1024) { alert('ไฟล์ใหญ่เกิน 800KB'); return null; }
      const b64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      return b64;
    }

    const file = $('biz-logo-file')?.files?.[0] || null;
    const fileUrl = await fileToDataURL(file);

    const body = {
      business: {
        name:    $('biz-name').value.trim(),
        address: $('biz-address').value.trim(),
        phone:   $('biz-phone').value.trim(),
        email:   $('biz-email').value.trim(),
        taxId:   $('biz-taxid').value.trim(),
        logoUrl: fileUrl || $('biz-logo-url').value.trim(), // ไฟล์มาก่อน URL
      },
      doc: {
        creditTermDays: Number($('doc-credit').value || 30),
        footerNote:     $('doc-footer').value.trim(),
      },
      tax: {
        useVat:           $('tax-use').checked,
        vatRate:          Number($('tax-rate').value || 7),
        pricesIncludeVat: $('tax-inc').checked,
      }
    };

    const btn = e.submitter || $('settings-save-btn');
    if (btn) { btn.disabled = true; btn.dataset._old = btn.innerText; btn.innerText = 'กำลังบันทึก...'; }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        location.replace('/login.html?reason=expired');
        return;
      }
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      const saved = await res.json();
      sessionStorage.setItem('settingsCache', JSON.stringify({ ts: Date.now(), data: saved }));
      fillForm(saved);
      alert('บันทึกแล้ว ✔︎');
    } catch (err) {
      console.error(err);
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = btn.dataset._old || 'บันทึก'; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // cache
    try {
      const cache = JSON.parse(sessionStorage.getItem('settingsCache') || 'null');
      if (cache && Date.now() - cache.ts < 5 * 60 * 1000) fillForm(cache.data);
    } catch {}

    // live preview โลโก้จาก URL
    $('biz-logo-url')?.addEventListener('input', (e) => setLogoPreview(e.target.value.trim()));

    // live preview โลโก้จากไฟล์
    $('biz-logo-file')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 850 * 1024) { alert('ไฟล์ใหญ่เกิน 800KB'); e.target.value = ''; return; }
      const fr = new FileReader();
      fr.onload = () => setLogoPreview(fr.result);
      fr.readAsDataURL(f);
    });

    $('settings-form')?.addEventListener('submit', saveSettings);
    loadSettings();
  });
})();
