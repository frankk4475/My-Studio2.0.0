// public/app.js (ฉบับสมบูรณ์ แก้ไขล่าสุด)

// ฟังก์ชันสำหรับสร้าง Header พร้อม Token
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // ถ้าไม่มี token ให้ส่งกลับไปหน้า login
        window.location.href = '/login.html';
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Element & Modal Instance Selection ---
    const bookingList = document.getElementById('booking-list');
    const addForm = document.getElementById('add-booking-form');
    const quoteModalEl = document.getElementById('quote-modal');
    const quoteModal = new bootstrap.Modal(quoteModalEl);
    const quoteForm = document.getElementById('quote-form');
    const quoteBookingIdInput = document.getElementById('quote-booking-id');
    const quoteItemsContainer = document.getElementById('quote-items-container');
    const addQuoteItemBtn = document.getElementById('add-quote-item-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // --- 2. Main Function to Fetch and Display Bookings ---
    async function fetchAndDisplayBookings() {
        try {
            const response = await fetch('/api/bookings', { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch bookings');
            
            const bookings = await response.json();
            bookingList.innerHTML = '';
            bookings.forEach(booking => {
                const listItem = document.createElement('div');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-start mb-2';
                const bookingDate = new Date(booking.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
                
                const statusBadges = {
                    Pending: '<span class="badge bg-warning text-dark">รอการยืนยัน</span>',
                    Confirmed: '<span class="badge bg-success">ยืนยันแล้ว (ล็อคงาน)</span>',
                    Cancelled: '<span class="badge bg-danger">ยกเลิก</span>'
                };

                listItem.innerHTML = `
                    <div class="ms-2 me-auto">
                        <div class="fw-bold d-flex justify-content-between">
                            ${booking.customer}
                            ${statusBadges[booking.status] || ''}
                        </div>
                        <p class="mb-1"><strong>วันที่:</strong> ${bookingDate}</p>
                        <p class="mb-1"><strong>รายละเอียด:</strong> ${booking.details || '-'}</p>
                        <small class="text-muted">ID: ${booking._id}</small>
                    </div>
                    <div class="controls">
                        <button class="btn btn-sm btn-outline-primary quote-btn" data-id="${booking._id}">ใบเสนอราคา</button>
                        <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="${booking._id}">แก้ไข</button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${booking._id}">ลบ</button>
                    </div>
                `;
                bookingList.appendChild(listItem);
            });
        } catch (error) {
            console.error('Error fetching bookings:', error);
            window.location.href = '/login.html';
        }
    }

    // --- 3. Event Listeners ---
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('authToken');
            window.location.href = '/login.html';
        };
    }

    addForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newBookingData = { customer: addForm.customer.value, date: addForm.date.value, details: addForm.details.value };
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: getAuthHeaders(), // **(แก้ไข)** เพิ่ม Headers
                body: JSON.stringify(newBookingData),
            });
            if (response.ok) {
                addForm.reset();
                fetchAndDisplayBookings();
            } else { alert('เกิดข้อผิดพลาดในการเพิ่มข้อมูล'); }
        } catch (error) { console.error('Error creating booking:', error); }
    });

    bookingList.addEventListener('click', (event) => {
        const target = event.target;
        const bookingId = target.dataset.id;
        if (target.classList.contains('quote-btn')) openQuoteModal(bookingId);
        if (target.classList.contains('edit-btn')) loadBookingForEdit(bookingId, target);
        if (target.classList.contains('delete-btn')) deleteBooking(bookingId);
    });

    quoteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const items = [];
        const itemNodes = quoteItemsContainer.querySelectorAll('.quote-item-row');
        itemNodes.forEach(node => {
            items.push({
                description: node.querySelector('.quote-item-desc').value,
                quantity: parseFloat(node.querySelector('.quote-item-qty').value) || 1,
                price: parseFloat(node.querySelector('.quote-item-price').value) || 0
            });
        });
        const quoteData = { bookingId: quoteBookingIdInput.value, items: items };

        try {
            const response = await fetch('/api/quotes', {
                method: 'POST',
                headers: getAuthHeaders(), // **(แก้ไข)** เพิ่ม Headers
                body: JSON.stringify(quoteData)
            });
            if (response.ok) {
                alert('สร้างใบเสนอราคาสำเร็จ!');
                quoteModal.hide();
            } else {
                const result = await response.json();
                alert(`เกิดข้อผิดพลาด: ${result.message || 'ไม่สามารถสร้างใบเสนอราคาได้'}`);
            }
        } catch (error) { console.error('Error creating quote:', error); }
    });

    // --- 4. Helper Functions ---
    async function deleteBooking(id) {
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
            try {
                const response = await fetch(`/api/bookings/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); // **(แก้ไข)** เพิ่ม Headers
                if (response.ok) fetchAndDisplayBookings();
                else alert('เกิดข้อผิดพลาดในการลบ');
            } catch (error) { console.error('Error deleting booking:', error); }
        }
    }

    async function loadBookingForEdit(id, buttonElement) {
        const listItem = buttonElement.closest('.list-group-item');
        try {
            const response = await fetch(`/api/bookings/${id}`, { headers: getAuthHeaders() }); // **(แก้ไข)** เพิ่ม Headers
            const bookingData = await response.json();
            const dateForInput = new Date(bookingData.date).toISOString().split('T')[0];
            
            listItem.innerHTML = `
                <form class="edit-form w-100" data-id="${bookingData._id}">
                    <h5 class="mb-3">แก้ไขการจอง</h5>
                    <div class="mb-2"><label class="form-label">ชื่อลูกค้า:</label><input type="text" name="customer" class="form-control" value="${bookingData.customer}" required></div>
                    <div class="mb-2"><label class="form-label">วันที่:</label><input type="date" name="date" class="form-control" value="${dateForInput}" required></div>
                    <div class="mb-2"><label class="form-label">รายละเอียด:</label><textarea name="details" class="form-control">${bookingData.details}</textarea></div>
                    <button type="submit" class="btn btn-success btn-sm">บันทึก</button>
                    <button type="button" class="btn btn-secondary btn-sm cancel-edit">ยกเลิก</button>
                </form>
            `;
            listItem.querySelector('.edit-form').addEventListener('submit', handleEditSubmit);
            listItem.querySelector('.cancel-edit').addEventListener('click', fetchAndDisplayBookings);
        } catch (error) { console.error('Error loading booking for edit:', error); }
    }

    async function handleEditSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const bookingId = form.dataset.id;
        const updatedData = { customer: form.customer.value, date: form.date.value, details: form.details.value };
        try {
            const response = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: getAuthHeaders(), // **(แก้ไข)** เพิ่ม Headers
                body: JSON.stringify(updatedData),
            });
            if (response.ok) {
                fetchAndDisplayBookings();
            } else { alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล'); }
        } catch (error) { console.error('Error updating booking:', error); }
    }

    function openQuoteModal(bookingId) {
        quoteBookingIdInput.value = bookingId;
        quoteItemsContainer.innerHTML = '';
        addQuoteItem();
        quoteModal.show();
    }
    
    function addQuoteItem() {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'quote-item-row d-flex gap-2 mb-2';
        itemDiv.innerHTML = `<input type="text" placeholder="คำอธิบาย" class="form-control quote-item-desc" required> <input type="number" placeholder="จำนวน" class="form-control quote-item-qty" value="1" style="width: 80px;"> <input type="number" placeholder="ราคา" class="form-control quote-item-price" required style="width: 120px;">`;
        quoteItemsContainer.appendChild(itemDiv);
    }
    addQuoteItemBtn.onclick = addQuoteItem;

    // --- 5. Initial Load ---
    fetchAndDisplayBookings();
});