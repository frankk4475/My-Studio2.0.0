document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('login-form');
  const errorEl = document.getElementById('error-message');
  const btn    = document.getElementById('btn-login');
  const userEl = document.getElementById('username');
  const passEl = document.getElementById('password');
  const reasonEl = document.getElementById('reason');
  const togglePass = document.getElementById('toggle-pass');

  // Clear existing session to prevent redirect loops and ensure a fresh start
  const existingToken = sessionStorage.getItem('authToken');
  const lastUser = sessionStorage.getItem('lastUsername');
  
  sessionStorage.clear();
  
  // Restore last username for convenience
  if (lastUser) sessionStorage.setItem('lastUsername', lastUser);
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
    btn.innerHTML = '⌛ กำลังตรวจสอบ...';
    console.log('🚀 Login attempt for:', username);

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('📡 Server response status:', res.status);
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        console.error('❌ Failed to parse JSON response');
        throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (Invalid JSON)');
      }

      if (!res.ok) {
        throw new Error(data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }

      if (!data.token) {
        throw new Error('ไม่ได้รับโทเค็นเข้าสู่ระบบจากเซิร์ฟเวอร์');
      }

      console.log('✅ Login successful, storing session...');
      sessionStorage.setItem('authToken', data.token);
      sessionStorage.setItem('userRole', data.role || 'Employee');
      sessionStorage.setItem('userName', data.displayName || username);
      sessionStorage.setItem('lastUsername', username);

      console.log('🔀 Redirecting to Dashboard...');
      window.location.replace('/dashboard.html');
    } catch (err) {
      console.error('❌ Login Error:', err);
      errorEl.textContent = err.message || 'ระบบขัดข้อง กรุณาลองใหม่ภายหลัง';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🚀 เข้าสู่ระบบ';
    }
  });
});
