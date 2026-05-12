document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('authToken');
  const tableBody = document.getElementById('customer-table-body');
  const sendBtn = document.getElementById('btn-send-line');
  let currentLineUserId = null;

  async function loadCustomers() {
    try {
      const res = await fetch('/api/customers', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const customers = await res.json();
      
      tableBody.innerHTML = customers.map(c => {
        const pic = c.linePictureUrl ? '<img src="' + c.linePictureUrl + '" class="rounded-circle me-2" width="32">' : '<div class="bg-secondary rounded-circle me-2" style="width:32px;height:32px"></div>';
        const lineStatus = c.lineUserId ? '<span class="badge bg-success">Connected</span>' : '<span class="badge bg-light text-dark">Not Linked</span>';
        const lastActive = new Date(c.lastActive).toLocaleString('th-TH');
        
        return '<tr>' +
          '<td>' +
            '<div class="d-flex align-items-center">' +
              pic +
              '<div>' +
                '<div class="fw-bold">' + c.name + '</div>' +
                '<div class="text-muted small">' + (c.lineDisplayName || 'No LINE Link') + '</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td>' + lineStatus + '</td>' +
          '<td>' + (c.phone || '-') + '</td>' +
          '<td>' + lastActive + '</td>' +
          '<td>' +
            '<button class="btn btn-sm btn-outline-primary" onclick="openMessageModal(\'' + c.lineUserId + '\', \'' + c.name + '\')" ' + (!c.lineUserId ? 'disabled' : '') + '>' +
              '💬 ส่งข้อความ' +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    } catch (e) {
      console.error('Load error:', e);
    }
  }

  window.openMessageModal = (userId, name) => {
    currentLineUserId = userId;
    document.getElementById('target-customer-name').textContent = name;
    document.getElementById('line-message-text').value = '';
    new bootstrap.Modal(document.getElementById('sendMessageModal')).show();
  };

  sendBtn.addEventListener('click', async () => {
    const message = document.getElementById('line-message-text').value;
    if (!message || !currentLineUserId) return;

    sendBtn.disabled = true;
    try {
      const res = await fetch('/api/customers/send-message', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token 
        },
        body: JSON.stringify({ lineUserId: currentLineUserId, message })
      });

      if (res.ok) {
        alert('ส่งข้อความสำเร็จ');
        bootstrap.Modal.getInstance(document.getElementById('sendMessageModal')).hide();
      } else {
        alert('ส่งข้อความไม่สำเร็จ');
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    } finally {
      sendBtn.disabled = false;
    }
  });

  loadCustomers();
});
