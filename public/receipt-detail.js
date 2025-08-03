function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) window.location.href = '/login.html';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('id'); // เปลี่ยนเป็น invoiceId เพื่อความชัดเจน

    if (!invoiceId) {
        document.body.innerHTML = '<h1>ไม่พบ ID ของเอกสาร</h1>';
        return;
    }

    async function fetchReceiptDetails() {
        try {
            // **(แก้ไข)** เปลี่ยน URL ให้ไปดึงข้อมูลจาก invoices
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Document not found or permission denied');
            }

            const invoice = await response.json();
            
            // **(แก้ไข)** นำข้อมูลจาก invoice ไปใส่ใน HTML
            document.getElementById('document-number').textContent = invoice.invoiceNumber;
            document.getElementById('document-date').textContent = new Date(invoice.issueDate).toLocaleDateString('th-TH');
            document.getElementById('customer-name').textContent = invoice.customerName;
            document.getElementById('document-total').textContent = invoice.total.toLocaleString();

            const itemsTable = document.getElementById('items-table'); // ใช้ ID ใหม่
            itemsTable.innerHTML = ''; 
            invoice.items.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${item.price.toLocaleString()}</td>
                    <td>${(item.quantity * item.price).toLocaleString()}</td>
                `;
                itemsTable.appendChild(row);
            });

        } catch (error) {
            console.error('Error fetching receipt details:', error);
            document.getElementById('receipt-content').innerHTML = `<h2>เกิดข้อผิดพลาด: ${error.message}</h2>`;
        }
    }
    
    fetchReceiptDetails();
});