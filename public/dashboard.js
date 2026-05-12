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
    const res = await fetch('/api/dashboard/stats', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const stats = await res.json();
    renderDashboard(stats);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderDashboard(s) {
  // Stats for the simplified KPI cards
  const bookingCount = document.getElementById('stat-bookings');
  const revenueCount = document.getElementById('stat-revenue');
  const lineCount    = document.getElementById('stat-line');

  if (bookingCount) bookingCount.textContent = s.bookings.total;
  if (revenueCount) revenueCount.textContent = money(s.invoices.totalAmount);
  if (lineCount)    lineCount.textContent    = s.lineStats.linked + ' / ' + s.lineStats.total;
}

document.addEventListener('DOMContentLoaded', fetchStats);
