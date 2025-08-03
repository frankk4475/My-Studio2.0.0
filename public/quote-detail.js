function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) window.location.href = '/login.html';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const type = params.get('type') || 'quote'; // รับ type มา ถ้าไม่มีให้เป็น quote

    if (!id) {
        document.body.innerHTML = '<h1>ไม่พบ ID</h1>';
        return;
    }

    async function fetchDetails() {
        let url = '';
        let title = '';
        let numberLabel = '';

        if (type === 'receipt' || type === 'invoice') {
            url = `/api/invoices/${id}`;
            title = (type === 'receipt') ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';
            numberLabel = (type === 'receipt') ? 'เลขที่ใบเสร็จ' : 'เลขที่ใบแจ้งหนี้';
        } else {
            url = `/api/quotes/${id}`;
            title = 'ใบเสนอราคา';
            numberLabel = 'เลขที่';
        }

        document.querySelector('h2').textContent = title;
        document.querySelector('#number-label').textContent = numberLabel;
        document.title = title;

        try {
            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Document not found');

            const data = await response.json();
            const documentNumber = data.quoteNumber || data.invoiceNumber;
            
            document.getElementById('document-number').textContent = documentNumber;
            document.getElementById('document-date').textContent = new Date(data.createdAt || data.issueDate).toLocaleDateString('th-TH');
            document.getElementById('customer-name').textContent = data.customerName;
            document.getElementById('document-total').textContent = data.total.toLocaleString();

            const itemsTable = document.getElementById('quote-items-table');
            itemsTable.innerHTML = '';
            data.items.forEach((item, index) => {
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
            console.error('Error fetching details:', error);
            document.getElementById('quote-content').innerHTML = `<h2>เกิดข้อผิดพลาด: ${error.message}</h2>`;
        }
    }
    
    fetchDetails();
});