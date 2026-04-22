
document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') {
        window.location.href = '../Auth/login.html';
        return;
    }

    const appointmentsContainer = document.querySelector('.appointments-container');
    const tabButtons = document.querySelectorAll('.tab-btn');
    let allAppointments = [];
    let doctorsMap = {};

    function showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${message}</span>`;

        Object.assign(toast.style, {
            position: 'fixed', top: '20px', right: '20px', padding: '15px 20px',
            background: type === 'success' ? '#4caf50' : '#f44336', color: 'white',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px',
            fontWeight: '500', zIndex: '9999', animation: 'slideInRight 0.3s ease-out'
        });

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    if (!document.querySelector('#toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
        `;
        document.head.appendChild(style);
    }


async function loadAppointments(filter = 'upcoming') {
    try {
        const appointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);
        const doctors = await HealthcareStorage. users.getAllDoctors();
        doctorsMap = Object.fromEntries(doctors.map(d => [d.id, d]));

        const now = new Date();

        allAppointments = appointments.map(app => {
            const dateTime = new Date(app.dateTime);
            
            // ✅ تأكد من أن status موجود ومعرّف صح
            let status = app.status || 'confirmed';

            // فقط غيّر لـ expired إذا كان confirmed والتاريخ اتجاوز
            if (status === 'confirmed' && dateTime < now) {
                status = 'expired';
            }

            return { ...app, status, dateTime };
        });

        let filtered = allAppointments;

        if (filter === 'all') {
            filtered = allAppointments;
        } else if (filter === 'upcoming') {
            filtered = allAppointments.filter(app => 
                app.status === 'confirmed' && app.dateTime > now
            );
        } else if (filter === 'completed') {
            filtered = allAppointments. filter(app => app.status === 'completed');
        } else if (filter === 'cancelled') {
            filtered = allAppointments.filter(app => app.status === 'cancelled');
        }

        console.log(`📊 Filtered [${filter}]: `, filtered); //  debugging
        renderAppointments(filtered);
    } catch (error) {
        console.error('Error loading appointments:', error);
        appointmentsContainer.innerHTML = '<p class="no-data">Error loading appointments.  Please refresh. </p>';
    }
}
    function renderAppointments(appointments) {
        if (appointments.length === 0) {
            appointmentsContainer.innerHTML = '<p class="no-data">No appointments found.</p>';
            return;
        }

        const html = appointments.map(app => {
            const doctor = doctorsMap[app.doctorId] || { fullname: 'Unknown Doctor', specialty: 'N/A' };
 const formattedDate = new Date(app.dateTime + 'Z').toLocaleDateString('en-US', { // أضف 'Z' عشان يعاملها UTC
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
});           const formattedTime = app.time || new Date(app.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const statusClass = {
    confirmed: 'confirmed',
    completed: 'completed',  // ← مهم
    cancelled: 'cancelled',
    expired: 'expired'
}[app.status] || 'confirmed';

const statusText = {
    confirmed: 'Confirmed',
    completed: 'Completed',  // ← مهم
    cancelled: 'Cancelled',
    expired: 'Expired'
}[app.status] || 'Confirmed';
            return `
                <div class="appointment-item ${app.status === 'expired' ? 'expired' : ''}">
                    <div class="appointment-date-badge">
                        <div class="day">${new Date(app.dateTime).getDate()}</div>
                        <div class="month">${new Date(app.dateTime).toLocaleDateString('en-US', { month: 'short' })}</div>
                    </div>
                    <div class="appointment-details">
                        <div class="appointment-main-info">
                            <h3>Dr. ${doctor.fullname}</h3>
                            <div class="appointment-meta">
                                <span class="meta-item"><i class="fa-solid fa-stethoscope"></i> ${doctor.specialty}</span>
                                <span class="meta-item"><i class="fa-solid fa-clock"></i> ${formattedTime}</span>
                                <span class="meta-item"><i class="fa-solid fa-calendar"></i> ${formattedDate}</span>
                            </div>
                        </div>
                        <div class="appointment-status">
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="appointment-actions">
                        <button class="action-btn view-btn" onclick="viewDetails('${app.id}')">
                            <i class="fa-solid fa-eye"></i> View Details
                        </button>
                        ${app.status === 'confirmed' ? `
                            <button class="action-btn cancel-btn" onclick="cancelAppointment('${app.id}')">
                                <i class="fa-solid fa-times"></i> Cancel
                            </button>
                            <button class="action-btn reschedule-btn" onclick="rescheduleAppointment('${app.id}')">
                                <i class="fa-solid fa-calendar-alt"></i> Reschedule
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        appointmentsContainer.innerHTML = html;
    }

    // 🔧 FIX: Cancel Appointment مع خصم صحيح من الفيزا
    window.cancelAppointment = async function(id) {
        try {
            console.log('🔄 Cancelling appointment:', id);

            // جلب الموعد من db.json مباشرة
            const response = await fetch(`http://localhost:3000/appointments/${id}`);
            if (!response.ok) {
                throw new Error('Appointment not found');
            }
            
            const app = await response.json();
            console.log('📋 Found appointment:', app);

            const paidAmount = app.paidAmount || app.basePrice || 0;
            const policy = HealthcareStorage.payment.calculateCancellationFee(app.dateTime, paidAmount);

            console.log('💰 Cancellation policy:', policy);

            if (!policy.allowed) {
                showToast(policy.message, 'error');
                return;
            }

            const confirmMessage = policy.percentage === 0 
                ? `Cancel this appointment?\n\nYou will receive a FULL REFUND of ${policy.refund.toFixed(2)} EGP.`
                : `Cancel this appointment?\n\nRefund: ${policy.refund.toFixed(2)} EGP (${policy.percentage}% cancellation fee).`;

            if (!confirm(confirmMessage)) return;

            await fetch(`http://localhost:3000/appointments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'cancelled',
                    refundAmount: policy.refund,
                    cancelledAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });

            console.log('✅ Status updated to cancelled');

            // إرجاع الفلوس
            if (policy.refund > 0 && app.paymentCardNumber) {
                console.log('💳 Processing refund to card:', app.paymentCardNumber);
                
                const refundResult = await HealthcareStorage.payment.processRefund(
                    app.paymentCardNumber, 
                    policy.refund
                );
                
                console.log('💰 Refund result:', refundResult);

                if (refundResult.success) {
                    showToast(`✅ Cancelled! ${policy.refund.toFixed(2)} EGP refunded to your card.`, 'success');
                } else {
                    showToast(`⚠️ Cancelled, but refund failed. Contact support.`, 'error');
                }
            } else {
                showToast('✅ Appointment cancelled successfully.', 'success');
            }

            loadAppointments();
            
        } catch (error) {
            console.error('❌ Cancel error:', error);
            showToast('Failed to cancel appointment: ' + error.message, 'error');
        }
    };

    // 🔧 FIX: Reschedule Appointment
    window.rescheduleAppointment = async function(id) {
        try {
            console.log('🔄 Rescheduling appointment:', id);

            const response = await fetch(`http://localhost:3000/appointments/${id}`);
            if (!response.ok) {
                throw new Error('Appointment not found in database');
            }
            
            const app = await response.json();
            console.log('📋 Found appointment for reschedule:', app);

            const doctor = await HealthcareStorage.users.getById(app.doctorId);
            if (!doctor) {
                throw new Error('Doctor not found');
            }

            console.log('👨‍⚕️ Doctor info:', doctor);

            const rescheduleData = {
                specialty: doctor.specialty,
                doctorId: app.doctorId,
                doctorName: doctor.fullname,
                doctorPrice: app.basePrice || app.paidAmount || doctor.appointmentPrice,
                reason: app.reason || '',
                appointmentId: app.id,
                oldPaidAmount: app.paidAmount || 0
            };

            console.log('💾 Saving reschedule data:', rescheduleData);

            localStorage.setItem('rescheduleData', JSON.stringify(rescheduleData));
            window.location.href = 'book-appointment.html?reschedule=true';

        } catch (error) {
            console.error('❌ Reschedule error:', error);
            showToast('Failed to load appointment: ' + error.message, 'error');
        }
    };

window.viewDetails = async function(id) {
    try {
        const currentUser = HealthcareStorage.auth.getCurrentUser();
        if (!currentUser) return;

        const allAppointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);
        const numericId = Number(id);
        const app = allAppointments.find(a => a.id === numericId);

        if (!app) {
            showToast('Appointment not found.', 'error');
            return;
        }

        const doctor = await HealthcareStorage.users.getById(app.doctorId);
        const doctorName = doctor ? doctor.fullname : 'Unknown Doctor';
        const specialty = doctor ? doctor.specialty : 'N/A';

        const formattedDate = app.readableDate || new Date(app.dateTime).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });

        const formattedTime = app.time || new Date(app.dateTime).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        // ملء الـ Modal
        document.getElementById('modalDate').textContent = formattedDate;
        document.getElementById('modalTime').textContent = formattedTime;
        document.getElementById('modalDoctor').textContent = `Dr. ${doctorName}`;
        document.getElementById('modalSpecialty').textContent = specialty;
        document.getElementById('modalReason').textContent = app.reason || 'General consultation';

        const statusEl = document.getElementById('modalStatus');
        const statusText = app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Confirmed';
        statusEl.textContent = statusText;
        statusEl.className = 'status-badge';

        document.getElementById('appointmentModal').style.display = 'block';

    } catch (error) {
        console.error('View details error:', error);
        showToast('Failed to load details.', 'error');
    }
};

// Close Modal
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => document.getElementById('appointmentModal').style.display = 'none';
});

window.onclick = (e) => {
    if (e.target.id === 'appointmentModal') {
        e.target.style.display = 'none';
    }
};

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter || 'upcoming';
            loadAppointments(filter);
        });
    });

    await loadAppointments('upcoming');
});