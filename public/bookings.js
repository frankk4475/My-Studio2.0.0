(function() {
  const token = sessionStorage.getItem('authToken');
  const calendarEl = document.getElementById('calendar');
  const detailModal = new bootstrap.Modal(document.getElementById('event-detail-modal'));
  const addModal = new bootstrap.Modal(document.getElementById('addBookingModal'));
  const editModal = new bootstrap.Modal(document.getElementById('editBookingModal'));

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  window.showToast = (m, e = false) => {
    const t = document.getElementById('app-toast'), b = document.getElementById('toast-msg');
    if (!t || !b) return;
    b.textContent = m || (e ? 'เกิดข้อผิดพลาด' : 'ทำรายการสำเร็จ');
    t.classList.toggle('text-bg-danger', !!e);
    t.classList.toggle('text-bg-success', !e);
    bootstrap.Toast.getOrCreateInstance(t).show();
  };

  async function apiFetch(url, init = {}) {
    const headers = { 'Authorization': `Bearer ${token}`, ...init.headers };
    if (init.json) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(init.json);
    }
    const res = await fetch(url, { ...init, headers });
    if (res.status === 401 || res.status === 403) {
      sessionStorage.clear();
      location.replace('/login.html');
      throw new Error('Unauthorized');
    }
    return res;
  }

  const STATUS = {
    Confirmed: { label:'ยืนยันแล้ว',   color:'#22c55e', pill:'evt-green'  },
    Pending:   { label:'รอการยืนยัน', color:'#facc15', pill:'evt-yellow' },
    Cancelled: { label:'ยกเลิก',      color:'#ef4444', pill:'evt-red'    },
  };

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'th',
    aspectRatio: 1.35,
    expandRows: true,
    fixedWeekCount: false,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    selectable: true,
    dateClick: (info) => {
      document.getElementById('add-date').value = info.dateStr;
      addModal.show();
    },
    events: async (info, success, failure) => {
      try {
        const qs = new URLSearchParams({ start: info.startStr, end: info.endStr });
        const res = await apiFetch('/api/bookings?' + qs.toString());
        const body = await res.json();
        const rows = Array.isArray(body) ? body : (body && body.data) ? body.data : [];
        success(rows.map(b => ({
          id: b._id,
          title: b.customer,
          start: b.startTime ? `${new Date(b.date).toISOString().split('T')[0]}T${b.startTime}` : b.date,
          end: b.endTime ? `${new Date(b.date).toISOString().split('T')[0]}T${b.endTime}` : b.date,
          color: (STATUS[b.status] || STATUS.Pending).color,
          extendedProps: { ...b, stLabel: (STATUS[b.status] || STATUS.Pending).label, pill: (STATUS[b.status] || STATUS.Pending).pill }
        })));
      } catch (e) { failure(e); }
    },
    eventContent: (arg) => {
      const p = arg.event.extendedProps;
      return { html: `<div class="evt-chip ${p.pill}"><i class="evt-dot"></i><span class="evt-title">${esc(arg.event.title)}</span></div>` };
    },
    eventClick: (info) => {
      const b = info.event.extendedProps;
      document.getElementById('event-title').textContent = b.customer;
      document.getElementById('event-body').innerHTML = `
        <p><strong>ประเภทงาน:</strong> ${esc(b.bookingType || '-')}</p>
        <p><strong>วันที่:</strong> ${new Date(b.date).toLocaleDateString('th-TH')}</p>
        <p><strong>เวลา:</strong> ${b.startTime} - ${b.endTime}</p>
        <p><strong>สถานะ:</strong> ${b.stLabel}</p>
        <p><strong>รายละเอียด:</strong> ${esc(b.details || '-')}</p>
      `;
      
      // Reset AI container
      document.getElementById('ai-suggestion-container').classList.add('d-none');
      document.getElementById('ai-suggestion-content').innerHTML = '';

      document.getElementById('btn-ai-shotlist').onclick = async () => {
        const btn = document.getElementById('btn-ai-shotlist');
        btn.disabled = true;
        btn.textContent = 'กำลังคิด...';
        try {
          const res = await apiFetch('/api/ai/shot-list', {
            method: 'POST',
            json: { bookingId: b._id }
          });
          const data = await res.json();
          document.getElementById('ai-suggestion-container').classList.remove('d-none');
          document.getElementById('ai-suggestion-content').innerHTML = data.creativeDirection.replace(/\n/g, '<br>');
        } catch (err) {
          showToast('AI Error: ' + err.message, true);
        } finally {
          btn.disabled = false;
          btn.textContent = '✨ AI Suggest Shot List';
        }
      };

      document.getElementById('btn-edit-from-detail').onclick = () => {
        detailModal.hide();
        loadForEdit(b._id);
      };
      document.getElementById('btn-assign-task').onclick = () => {
        location.href = `/tasks.html?bookingId=${b._id}`;
      };
      detailModal.show();
    }
  });

  calendar.render();

  // Add Booking
  document.getElementById('add-booking-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const json = Object.fromEntries(fd.entries());
    try {
      await apiFetch('/api/bookings', { method: 'POST', json });
      addModal.hide();
      e.target.reset();
      showToast('เพิ่มการจองสำเร็จ');
      calendar.refetchEvents();
    } catch (err) { showToast('เกิดข้อผิดพลาด', true); }
  };

  // Edit Booking
  async function loadForEdit(id) {
    try {
      const res = await apiFetch(`/api/bookings/${id}`);
      const b = await res.json();
      document.getElementById('edit-id').value = b._id;
      document.getElementById('edit-customer').value = b.customer;
      document.getElementById('edit-date').value = new Date(b.date).toISOString().split('T')[0];
      document.getElementById('edit-startTime').value = b.startTime;
      document.getElementById('edit-endTime').value = b.endTime;
      document.getElementById('edit-status').value = b.status;
      document.getElementById('edit-details').value = b.details || '';
      editModal.show();
    } catch (err) { showToast('โหลดข้อมูลล้มเหลว', true); }
  }

  document.getElementById('edit-booking-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const fd = new FormData(e.target);
    const json = Object.fromEntries(fd.entries());
    try {
      await apiFetch(`/api/bookings/${id}`, { method: 'PUT', json });
      editModal.hide();
      showToast('อัปเดตสำเร็จ');
      calendar.refetchEvents();
    } catch (err) { showToast('บันทึกไม่สำเร็จ', true); }
  };

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    sessionStorage.clear();
    location.replace('/login.html');
  });

})();
