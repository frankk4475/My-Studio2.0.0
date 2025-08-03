// public/quotes.js (ฉบับสมบูรณ์)

function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) window.location.href = '/login.html';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

document.addEventListener('DOMContentLoaded', () => {
    const quoteTableBody = document.getElementById('quote-table-body');

    async function fetchAndDisplayQuotes() {
        try {
            const response = await fetch('/api/quotes', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Authentication failed');
            const quotes = await response.json();

            quoteTableBody.innerHTML = '';
            if (quotes.length === 0) {
                quoteTableBody.innerHTML = '<tr><td colspan="6" class="text-center">ยังไม่มีใบเสนอราคา</td></tr>';
                return;
            }

            quotes.forEach(quote => {
                const row = document.createElement('tr');
                const quoteDate = new Date(quote.createdAt).toLocaleDateString('th-TH');
                const statusColors = { Draft: 'secondary', Sent: 'primary', Accepted: 'success', Declined: 'danger' };

                row.innerHTML = `
                    <td><a href="/quote-detail.html?id=${quote._id}">${quote.quoteNumber}</a></td>
                    <td>${quote.customerName}</td>
                    <td>${quote.total.toLocaleString()}</td>
                    <td>${quoteDate}</td>
                    <td>
                        <select class="form-select form-select-sm status-select" data-id="${quote._id}">
                            <option value="Draft" ${quote.status === 'Draft' ? 'selected' : ''}>Draft</option>
                            <option value="Sent" ${quote.status === 'Sent' ? 'selected' : ''}>Sent</option>
                            <option value="Accepted" ${quote.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="Declined" ${quote.status === 'Declined' ? 'selected' : ''}>Declined</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary edit-quote-btn" data-id="${quote._id}">แก้ไข</button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${quote._id}">ลบ</button>
                    </td>
                `;
                quoteTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error fetching quotes:', error);
            window.location.href = '/login.html';
        }
    }

    // Event Listener หลักสำหรับตาราง
    quoteTableBody.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const quoteId = event.target.dataset.id;
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบใบเสนอราคานี้?')) {
                try {
                    const response = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE', headers: getAuthHeaders() });
                    if (response.ok) fetchAndDisplayQuotes();
                    else alert('เกิดข้อผิดพลาดในการลบ');
                } catch (error) { console.error('Error deleting quote:', error); }
            }
            if (event.target.classList.contains('edit-quote-btn')) {
                const quoteId = event.target.dataset.id;
                // ฟังก์ชันนี้ต้องไปสร้างใน app.js หรือ import มา
                // เพื่อความง่าย เราจะจำลองการเปิด modal จากที่นี่
                alert(`กำลังจะเปิดฟอร์มแก้ไขสำหรับ Quote ID: ${quoteId}`);
                // ในชีวิตจริง: จะยิง GET /api/quotes/:id แล้วนำข้อมูลไปใส่ใน modal
            }
        }
    });

    quoteTableBody.addEventListener('change', async (event) => {
        if (event.target.classList.contains('status-select')) {
            const quoteId = event.target.dataset.id;
            const newStatus = event.target.value;
            try {
                const response = await fetch(`/api/quotes/${quoteId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: newStatus })
                });
                if (!response.ok) alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
                else {
                    // อาจจะแสดง feedback สั้นๆ
                    console.log('Status updated!');
                }
            } catch (error) { console.error('Error updating status:', error); }
        }
    });

    fetchAndDisplayQuotes();
});