// public/dashboard.js — Comprehensive Data Integration

async function loadDashboard() {
  const token = sessionStorage.getItem('authToken');
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    const res = await fetch('/api/dashboard', { headers });
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) location.replace('/login.html');
        throw new Error('API Error');
    }
    const data = await res.json();

    // 1. Main Stats
    document.getElementById('stat-bookings').textContent = (data.bookingsCount || 0).toLocaleString();
    document.getElementById('stat-revenue').textContent = (data.revenueMonth || 0).toLocaleString() + '.-';
    document.getElementById('stat-unpaid').textContent = (data.unpaidInvoices?.total || 0).toLocaleString() + '.-';
    document.getElementById('stat-pending').textContent = (data.pendingBookingsCount || 0).toLocaleString();

    // 2. Secondary Stats
    document.getElementById('stat-staff-total').textContent = data.staffCount || 0;
    
    const eq = data.equipment || {};
    document.getElementById('stat-equip-avail').textContent = eq.Available || 0;
    document.getElementById('stat-equip-use').textContent = eq.InUse || 0;
    document.getElementById('stat-equip-maint').textContent = eq.Maintenance || 0;

    // 3. Financial Widgets
    document.getElementById('stat-quotes-pending').textContent = data.pendingQuotes || 0;
    document.getElementById('stat-invoices-unpaid').textContent = data.unpaidInvoices?.count || 0;

    // 4. Chart
    if (data.revenueHistory) {
      initChart(data.revenueHistory);
    }

    // 5. Today's Jobs
    renderTodayJobs(data.todayJobs || []);

    // 6. Recent Bookings
    renderRecentBookings(data.recentBookings || []);

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function initChart(history) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const labels = history.map(h => h.month);
  const values = history.map(h => h.amount);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'รายได้ (บาท)',
        data: values,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4f46e5',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (ctx) => `ยอดเงิน: ${ctx.parsed.y.toLocaleString()} บาท`
            }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { 
              color: '#64748b',
              callback: (v) => v >= 1000 ? (v/1000) + 'k' : v
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}

function renderTodayJobs(jobs) {
  const list = document.getElementById('today-jobs-list');
  document.getElementById('today-jobs-count').textContent = jobs.length;

  if (jobs.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-5">🎉 วันนี้ยังไม่มีรายการจอง</div>';
    return;
  }

  list.innerHTML = jobs.map(j => `
    <div class="p-3 border-bottom hover-bg-light">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-bold">${j.customer}</div>
          <div class="small text-muted">${j.bookingType || 'ไม่ระบุประเภท'}</div>
        </div>
        <div class="text-end">
          <div class="badge bg-primary-light text-primary">${j.startTime} - ${j.endTime}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderRecentBookings(bookings) {
  const list = document.getElementById('recent-bookings-list');
  if (bookings.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-4">ไม่มีรายการจองล่าสุด</div>';
    return;
  }

  const statusMap = {
    'Pending': { class: 'badge-warning', text: 'รอยืนยัน' },
    'Confirmed': { class: 'badge-success', text: 'ยืนยันแล้ว' },
    'Cancelled': { class: 'badge-danger', text: 'ยกเลิก' }
  };

  list.innerHTML = bookings.map(b => `
    <div class="d-flex align-items-center justify-content-between p-3 border-bottom">
      <div>
        <div class="fw-bold">${b.customer}</div>
        <div class="small text-muted">${new Date(b.date).toLocaleDateString('th-TH')} | ${b.bookingType || '-'}</div>
      </div>
      <span class="badge ${statusMap[b.status]?.class || 'badge-info'}">
        ${statusMap[b.status]?.text || b.status}
      </span>
    </div>
  `).join('');
}

// Initialize
document.addEventListener('DOMContentLoaded', loadDashboard);

// Listen for real-time updates from layout.js
window.addEventListener('bookingChanged', () => {
  console.log('🔄 Dashboard: Refreshing data due to real-time update...');
  loadDashboard();
});
