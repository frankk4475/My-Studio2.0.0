// public/dashboard.js

function getAuthToken() {
  const t = sessionStorage.getItem('authToken');
  if (!t) { location.replace('/login.html'); throw new Error('Missing token'); }
  return t;
}

function getAuthHeaders() {
  return { 
    'Authorization': `Bearer ${getAuthToken()}`,
    'Accept': 'application/json'
  };
}

const money = n => Number(n || 0).toLocaleString('th-TH', { 
  style: 'currency', 
  currency: 'THB',
  minimumFractionDigits: 2 
});

async function fetchStats() {
  try {
    console.log('Fetching dashboard stats...');
    const res = await fetch('/api/dashboard/stats', { headers: getAuthHeaders() });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Dashboard API Error:', res.status, errorData);
        alert('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ (Error ' + res.status + ')');
        throw new Error('Failed to fetch stats');
    }
    
    const stats = await res.json();
    console.log('Dashboard stats received:', stats);
    
    if (stats.debug && stats.debug.rawCounts) {
        console.log('Raw document counts in DB:', stats.debug.rawCounts);
    }
    
    renderDashboard(stats);
  } catch (err) {
    console.error('Dashboard script error:', err);
  }
}

function renderDashboard(s) {
  if (!s || !s.invoices || !s.bookings) {
      console.error('Invalid stats data structure:', s);
      return;
  }

  // KPI Cards
  document.getElementById('stat-total-revenue').textContent = money(s.invoices.totalAmount);
  document.getElementById('stat-paid-amount').textContent    = money(s.invoices.totalPaid);
  document.getElementById('stat-pending-amount').textContent = money(s.invoices.totalPending || 0);
  document.getElementById('stat-active-tasks').textContent   = s.activeAssignments;

  // Booking Stats
  const bookingBox = document.getElementById('booking-stats-container');
  bookingBox.innerHTML = '';
  const bookingStatuses = [
    { key: 'Confirmed', label: 'ยืนยันแล้ว', color: 'bg-success' },
    { key: 'Pending', label: 'รอการยืนยัน', color: 'bg-warning' },
    { key: 'Cancelled', label: 'ยกเลิก', color: 'bg-danger' }
  ];

  bookingStatuses.forEach(st => {
    const count = s.bookings.byStatus[st.key] || 0;
    const pct = s.bookings.total ? (count / s.bookings.total * 100).toFixed(0) : 0;
    const html = `
      <div class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <span class="small">${st.label}</span>
          <span class="small fw-bold">${count} รายการ (${pct}%)</span>
        </div>
        <div class="progress">
          <div class="progress-bar ${st.color}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
    bookingBox.innerHTML += html;
  });

  // Inventory Stats
  document.getElementById('inv-total-count').textContent = s.equipment.total;
  document.getElementById('inv-available-count').textContent = s.equipment.byStatus['Available'] || 0;

  const invBox = document.getElementById('inv-stats-container');
  invBox.innerHTML = '';
  const invStatuses = [
    { key: 'In Use', label: 'กำลังใช้งาน', color: 'bg-primary' },
    { key: 'Maintenance', label: 'ส่งซ่อม', color: 'bg-warning' },
    { key: 'Retired', label: 'เลิกใช้งาน', color: 'bg-danger' }
  ];

  invStatuses.forEach(st => {
    const count = s.equipment.byStatus[st.key] || 0;
    const pct = s.equipment.total ? (count / s.equipment.total * 100).toFixed(0) : 0;
    const html = `
      <div class="mb-3">
        <div class="d-flex justify-content-between mb-1">
          <span class="small text-muted">${st.label}</span>
          <span class="small fw-bold">${count}</span>
        </div>
        <div class="progress" style="height: 4px;">
          <div class="progress-bar ${st.color}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
    invBox.innerHTML += html;
  });
}

document.addEventListener('DOMContentLoaded', fetchStats);
