function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) window.location.href = '/login.html';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

document.addEventListener('DOMContentLoaded', () => {
    const invoiceTableBody = document.getElementById('invoice-table-body');

    async function fetchAndDisplayInvoices() {
        try {
            const response = await fetch('/api/invoices', { headers: getAuthHeaders() });
            const invoices = await response.json();
            invoiceTableBody.innerHTML = '';
            
            invoices.forEach(invoice => {
                const row = document.createElement('tr');
                const dueDate = new Date(invoice.dueDate).toLocaleDateString('th-TH');
                
                row.innerHTML = `
                    <td>${invoice.invoiceNumber}</td>
                    <td>${invoice.customerName}</td>
                    <td>${invoice.total.toLocaleString()}</td>
                    <td>${dueDate}</td>
                    <td>
                        <select class="form-select form-select-sm payment-status-select" data-id="${invoice._id}" ${invoice.paymentStatus === 'Paid' ? 'disabled' : ''}>
                            <option value="Unpaid" ${invoice.paymentStatus === 'Unpaid' ? 'selected' : ''}>ยังไม่ชำระ</option>
                            <option value="Paid" ${invoice.paymentStatus === 'Paid' ? 'selected' : ''}>ชำระแล้ว</option>
                        </select>
                    </td>
                    <td>
                        ${invoice.paymentStatus === 'Paid' 
                            ? `<a href="/quote-detail.html?id=${invoice.quoteId._id}&type=receipt" class="btn btn-sm btn-success">ดูใบเสร็จ</a>`
                            : `<a href="/quote-detail.html?id=${invoice.quoteId._id}&type=invoice" class="btn btn-sm btn-outline-primary">ดูใบแจ้งหนี้</a>`
                        }
                    </td>
                `;
                invoiceTableBody.appendChild(row);
            });
        } catch (error) { console.error('Error fetching invoices:', error); }
    }

    invoiceTableBody.addEventListener('change', async (event) => {
        if (event.target.classList.contains('payment-status-select')) {
            const invoiceId = event.target.dataset.id;
            const newStatus = event.target.value;
            try {
                const response = await fetch(`/api/invoices/${invoiceId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ paymentStatus: newStatus })
                });
                if (response.ok) fetchAndDisplayInvoices();
                else alert('เกิดข้อผิดพลาด');
            } catch (error) { console.error('Error updating payment status:', error); }
        }
    });

    fetchAndDisplayInvoices();
});