async function loadDashboard() {
  const token = sessionStorage.getItem('authToken');
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    const res = await fetch('/api/dashboard', { headers });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('stat-bookings').textContent = data.bookingsCount || 0;
      document.getElementById('stat-revenue').textContent = (data.revenueMonth || 0).toLocaleString() + '.-';
      document.getElementById('stat-line').textContent = data.lineConnectedCount || 0;
      document.getElementById('stat-pending').textContent = data.pendingBookingsCount || 0;

      // Populate Chart if data exists
      if (data.revenueHistory) {
        initChart(data.revenueHistory);
      }

      // Populate Recent Bookings
      renderRecentBookings(data.recentBookings || []);
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function initChart(history) {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  
  // Example labels: Last 6 months
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
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
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
        <div class="small text-muted">${new Date(b.date).toLocaleDateString('th-TH')}</div>
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
