document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('setup-form');
  const errorEl = document.getElementById('error-message');
  const btn = document.getElementById('btn-setup');

  // Check if already initialized
  try {
    const res = await fetch('/api/users/check-init');
    const data = await res.json();
    if (data.initialized) {
      window.location.href = '/login.html';
      return;
    }
  } catch (e) {
    console.error('Check init failed', e);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('d-none');
    errorEl.textContent = '';

    const username = document.getElementById('username').value.trim();
    const displayName = document.getElementById('displayName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      errorEl.textContent = 'รหัสผ่านไม่ตรงกัน';
      errorEl.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'กำลังสร้างบัญชี...';

    try {
      const res = await fetch('/api/users/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'การตั้งค่าล้มเหลว');

      alert('ตั้งค่าสำเร็จ! กรุณาเข้าสู่ระบบด้วยบัญชีที่สร้าง');
      window.location.href = '/login.html';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('d-none');
      btn.disabled = false;
      btn.textContent = 'สร้างบัญชีและเริ่มต้น';
    }
  });
});
