// public/register.js — Customer Registration Logic

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const lineUserId = urlParams.get('userId');
  
  if (!lineUserId) {
    alert('❌ ไม่พบข้อมูล LINE User ID กรุณาเข้าผ่านลิงก์จาก LINE Bot ครับ');
    document.getElementById('btn-submit').disabled = true;
    return;
  }

  document.getElementById('lineUserId').value = lineUserId;

  const form = document.getElementById('registration-form');
  const btn = document.getElementById('btn-submit');
  const formView = document.getElementById('form-view');
  const successView = document.getElementById('success-view');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
      lineUserId: document.getElementById('lineUserId').value,
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      company: document.getElementById('company').value.trim(),
      taxId: document.getElementById('taxId').value.trim(),
      social: document.getElementById('social').value.trim(),
      address: document.getElementById('address').value.trim(),
    };

    btn.disabled = true;
    btn.innerHTML = '⌛ กำลังบันทึกข้อมูล...';

    try {
      const res = await fetch('/api/customers/register-via-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        formView.classList.add('d-none');
        successView.classList.remove('d-none');
        window.scrollTo(0, 0);
      } else {
        const data = await res.json();
        alert('❌ บันทึกไม่สำเร็จ: ' + (data.message || 'Unknown error'));
        btn.disabled = false;
        btn.innerHTML = '🚀 บันทึกข้อมูลลงทะเบียน';
      }
    } catch (err) {
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่ภายหลัง');
      btn.disabled = false;
      btn.innerHTML = '🚀 บันทึกข้อมูลลงทะเบียน';
    }
  });
});
