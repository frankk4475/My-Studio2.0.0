/**
  Layout Engine for My-Studio 2.0
  Dynamically injects Sidebar and Topbar into pages.
*/

const layout = {
  inject() {
    const isPublic = this.checkAuth();
    const hasToken = sessionStorage.getItem('authToken');

    if (hasToken) {
      this.sidebar();
      this.topbar();
      this.setupEvents();
      this.initSocket();
    } else if (isPublic) {
      // Clean up layout for public pages
      const mainWrapper = document.querySelector('.main-wrapper');
      if (mainWrapper) mainWrapper.style.marginLeft = '0';
      const sidebarContainer = document.getElementById('sidebar-container');
      if (sidebarContainer) sidebarContainer.style.display = 'none';
      const topbarContainer = document.getElementById('topbar-container');
      if (topbarContainer) topbarContainer.style.display = 'none';
    }
    this.addToastContainer();
  },

  checkAuth() {
    const publicPages = [
        '/login.html', 
        '/setup.html', 
        '/register.html', 
        '/quote-detail.html', 
        '/billing-detail.html',
        '/receipt-detail.html',
        '/loan-detail.html',
        '/booking-detail.html',
        '/'
    ];
    const isPublicPage = publicPages.includes(window.location.pathname);
    const hasToken = sessionStorage.getItem('authToken');

    if (!isPublicPage && !hasToken) {
      console.warn('🔒 Unauthorized access, redirecting to login...');
      window.location.replace('/login.html?reason=expired');
    }
    return isPublicPage;
  },

  initSocket() {
    // Load Socket.io client if not already loaded
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = () => this.connectSocket();
      document.head.appendChild(script);
    } else {
      this.connectSocket();
    }
  },

  connectSocket() {
    const socket = io();
    console.log('🔌 Connected to Real-time updates');

    socket.on('bookingCreated', (data) => {
      this.showToast(`🆕 มีการจองใหม่: ${data.customer}`, 'success');
      // Dispatch global event for other scripts to listen
      window.dispatchEvent(new CustomEvent('bookingChanged', { detail: { type: 'created', data } }));
    });

    socket.on('bookingUpdated', (data) => {
      window.dispatchEvent(new CustomEvent('bookingChanged', { detail: { type: 'updated', data } }));
    });

    socket.on('bookingDeleted', (data) => {
      window.dispatchEvent(new CustomEvent('bookingChanged', { detail: { type: 'deleted', data } }));
    });
  },

  addToastContainer() {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
      success: '#10b981',
      error: '#f43f5e',
      warning: '#f59e0b',
      info: '#4f46e5'
    };
    
    toast.className = 'card shadow-lg';
    toast.style.cssText = `
      padding: 12px 20px;
      background: white;
      border-left: 5px solid ${colors[type]};
      min-width: 250px;
      animation: slideIn 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 12px;
    `;
    
    toast.innerHTML = `
      <div style="font-size: 20px;">${type === 'success' ? '✅' : 'ℹ️'}</div>
      <div>
        <div style="font-weight: 600; font-size: 14px;">แจ้งเตือน</div>
        <div style="font-size: 13px; color: #64748b;">${message}</div>
      </div>
    `;

    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  },

  sidebar() {
    const sidebarEl = document.getElementById('sidebar-container');
    if (!sidebarEl) return;

    const activePage = window.location.pathname;
    const isAdmin = sessionStorage.getItem('userRole') === 'Admin';

    sidebarEl.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="brand-logo">M</div>
          <div class="brand-name">My-Studio 2.0</div>
        </div>
        
        <nav class="sidebar-nav">
          <a href="/dashboard.html" class="nav-item ${activePage.includes('dashboard') ? 'active' : ''}">
            <span class="icon">📊</span> แดชบอร์ด
          </a>
          <a href="/index.html" class="nav-item ${activePage.includes('index') || activePage === '/' ? 'active' : ''}">
            <span class="icon">📒</span> การจอง
          </a>
          <a href="/customers.html" class="nav-item ${activePage.includes('customers') ? 'active' : ''}">
            <span class="icon">👥</span> ลูกค้า & LINE
          </a>
          <a href="/quotes.html" class="nav-item ${activePage.includes('quotes') ? 'active' : ''}">
            <span class="icon">💬</span> ใบเสนอราคา
          </a>
          <a href="/invoices.html" class="nav-item ${activePage.includes('invoices') ? 'active' : ''}">
            <span class="icon">🧾</span> ใบแจ้งหนี้
          </a>
          <a href="/calendar.html" class="nav-item ${activePage.includes('calendar') ? 'active' : ''}">
            <span class="icon">📆</span> ปฏิทินงาน
          </a>
          <a href="/tasks.html" class="nav-item ${activePage.includes('tasks') ? 'active' : ''}">
            <span class="icon">👷</span> จ่ายงาน
          </a>
          <a href="/inventory.html" class="nav-item ${activePage.includes('inventory') ? 'active' : ''}">
            <span class="icon">📦</span> คลังอุปกรณ์
          </a>
          ${isAdmin ? `
          <a href="/employees.html" class="nav-item ${activePage.includes('employees') ? 'active' : ''}">
            <span class="icon">👥</span> พนักงาน
          </a>
          <a href="/settings.html" class="nav-item ${activePage.includes('settings') ? 'active' : ''}">
            <span class="icon">⚙️</span> ตั้งค่า
          </a>
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <button id="btn-logout" class="btn btn-outline w-100" style="background: rgba(255,255,255,0.05); color: #fff; border: none;">
            🚪 ออกจากระบบ
          </button>
        </div>
      </aside>
    `;
  },

  topbar() {
    const topbarEl = document.getElementById('topbar-container');
    if (!topbarEl) return;

    const userName = sessionStorage.getItem('userName') || 'User';
    const userRole = sessionStorage.getItem('userRole') || 'Staff';

    topbarEl.innerHTML = `
      <header class="top-bar">
        <div class="d-flex align-items-center gap-3">
          <button class="btn btn-outline d-lg-none" id="sidebar-toggle">☰</button>
          <h2 class="h5 m-0 fw-bold" id="page-title">${document.title.split(' - ')[0]}</h2>
        </div>
        <div class="user-profile d-flex align-items-center gap-2">
          <div class="text-end d-none d-sm-block">
            <div class="fw-bold">${userName}</div>
            <div class="small text-muted">${userRole}</div>
          </div>
          <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ${userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>
    `;
  },

  setupEvents() {
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      sessionStorage.clear();
      window.location.replace('/login.html');
    });

    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
  }
};

// Auto-run if elements exist
document.addEventListener('DOMContentLoaded', () => layout.inject());
