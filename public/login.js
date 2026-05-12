document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('login-form');
  const errorEl = document.getElementById('error-message');
  const btn    = document.getElementById('btn-login');
  const userEl = document.getElementById('username');
  const passEl = document.getElementById('password');
  const reasonEl = document.getElementById('reason');
  const togglePass = document.getElementById('toggle-pass');

  // ถ้ามี token อยู่แล้ว ส่งเข้าหน้า index เลย
  const existing = sessionStorage.getItem('authToken');
  if (existing) {
    window.location.href = '/index.html';
    return;
  }

  // ลบ token เก่าทิ้งเพื่อความชัวร์เมื่อมายังหน้า login
  sessionStorage.clear();

  // เติมเหตุผลถ้ามาจาก token หมดอายุ
  const usp = new URLSearchParams(location.search);
  if (usp.get('reason') === 'expired') {
    reasonEl.textContent = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    reasonEl.classList.remove('d-none');
  }

  // จำ username ครั้งก่อน (quality of life)
  const lastUser = sessionStorage.getItem('lastUsername');
  if (lastUser) userEl.value = lastUser;

  // สลับแสดง/ซ่อนรหัสผ่าน
  togglePass.addEventListener('click', () => {
    const isPw = passEl.type === 'password';
    passEl.type = isPw ? 'text' : 'password';
    togglePass.textContent = isPw ? 'ซ่อน' : 'แสดง';
    passEl.focus();
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorEl.textContent = '';

    const username = userEl.value.trim();
    const password = passEl.value;

    if (!username || !password) {
      errorEl.textContent = 'กรุณากรอกข้อมูลให้ครบ';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'กำลังเข้าสู่ระบบ...';

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      // บางกรณี server อาจส่ง non‑JSON กลับมาได้ จัดการให้ปลอดภัย
      let data = null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        const t = await res.text();
        try { data = JSON.parse(t); } catch { data = { message: t }; }
      }

      if (!res.ok) {
        throw new Error((data && data.message) || res.statusText || 'Invalid credentials.');
      }

      if (!data || !data.token) {
        throw new Error('ไม่พบโทเค็นตอบกลับจากระบบ');
      }

      // บันทึก token + จำชื่อผู้ใช้ + บทบาท
      sessionStorage.setItem('authToken', data.token);
      sessionStorage.setItem('userRole', data.role || 'Employee');
      sessionStorage.setItem('lastUsername', username);

      // เข้าหน้าหลัก
      window.location.href = '/index.html';
    } catch (err) {
      console.error('Login error:', err);
      errorEl.textContent = err.message || 'ไม่สามารถเข้าสู่ระบบได้';
    } finally {
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
    }
  });
});
