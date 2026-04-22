document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') {
        window.location.href = '../Auth/login.html';
        return;
    }

    let currentStep = 1;
    let appointmentData = {
        specialty: '',
        doctorId: '',
        doctorName: '',
        doctorPrice: 0,
        date: '',
        readableDate: '',
        time: '',
        reason: '',
        rescheduleId: null,
        oldPaidAmount: 0
    };
    let allDoctors = [];

    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const specialtiesGrid = document.querySelector('.specialties-grid');
    const doctorsGrid = document.querySelector('.doctors-grid');
    const timeSlotsGrid = document.querySelector('.time-slots-grid');
    const quickDatesContainer = document.querySelector('.quick-dates');
    const reasonTextarea = document.getElementById('appointmentReason');
    const pageError = document.getElementById('pageError');
    const pageErrorText = document.getElementById('pageErrorText');

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

    function showPaymentModal(appointmentData, pricingInfo, onSuccess) {
        const modal = document.createElement('div');
        modal.className = 'payment-modal';
        modal.innerHTML = `
            <div class="payment-overlay"></div>
            <div class="payment-content">
                <div class="payment-header">
                    <i class="fa-solid fa-credit-card"></i>
                    <h2>Payment Required</h2>
                    <button class="close-payment"><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="payment-body">
                    <div class="appointment-summary">
                        <h3><i class="fa-solid fa-receipt"></i> Appointment Summary</h3>
                        <div class="summary-row"><span>Doctor:</span><strong>Dr. ${appointmentData.doctorName}</strong></div>
                        <div class="summary-row"><span>Date & Time:</span><strong>${appointmentData.readableDate} at ${appointmentData.time}</strong></div>
                        <div class="summary-row total"><span>Total Amount:</span><strong>${pricingInfo.totalPrice.toFixed(2)} EGP</strong></div>
                    </div>
                    <div class="payment-form">
                        <h3><i class="fa-solid fa-lock"></i> Secure Payment</h3>
                        <div class="form-group">
                            <label>Card Number</label>
                            <input type="text" id="cardNumber" placeholder="4532 0151 1283 0366" maxlength="19">
                            <i class="fa-brands fa-cc-visa card-icon"></i>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Expiry Date</label>
                                <input type="text" id="expiryDate" placeholder="MM/YY" maxlength="5">
                            </div>
                            <div class="form-group">
                                <label>CVV</label>
                                <input type="text" id="cvv" placeholder="123" maxlength="3">
                            </div>
                        </div>
                        <div class="payment-info">
                            <i class="fa-solid fa-shield-halved"></i>
                            <span>Your payment is secure and encrypted</span>
                        </div>
                        <div id="paymentError" class="payment-error" style="display: none;"></div>
                    </div>
                </div>
                <div class="payment-footer">
                    <button class="btn-cancel-payment">Cancel</button>
                    <button class="btn-pay" id="payBtn">
                        <i class="fa-solid fa-lock"></i> Pay ${pricingInfo.totalPrice.toFixed(2)} EGP
                    </button>
                </div>
            </div>
        `;

        if (!document.getElementById('payment-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'payment-modal-styles';
            style.textContent = `
                .payment-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .payment-overlay { position: absolute; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); }
                .payment-content { position: relative; background: white; border-radius: 20px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: slideUp 0.3s ease-out; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
                .payment-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 20px 20px 0 0; text-align: center; color: white; position: relative; }
                .payment-header i.fa-credit-card { font-size: 48px; margin-bottom: 15px; }
                .payment-header h2 { margin: 0; font-size: 24px; }
                .close-payment { position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.2); border: none; width: 35px; height: 35px; border-radius: 50%; color: white; cursor: pointer; font-size: 18px; transition: all 0.3s; }
                .close-payment:hover { background: rgba(255, 255, 255, 0.3); transform: rotate(90deg); }
                .payment-body { padding: 30px; }
                .appointment-summary { background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 25px; }
                .appointment-summary h3 { font-size: 16px; color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
                .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
                .summary-row:last-child { border-bottom: none; }
                .summary-row.total { margin-top: 10px; padding-top: 15px; border-top: 2px solid #667eea; font-size: 18px; font-weight: 700; color: #667eea; }
                .payment-form h3 { font-size: 16px; color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
                .form-group { margin-bottom: 20px; position: relative; }
                .form-group label { display: block; font-size: 13px; color: #666; font-weight: 600; margin-bottom: 8px; }
                .form-group input { width: 100%; padding: 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; transition: border-color 0.3s; }
                .form-group input:focus { border-color: #667eea; outline: none; }
                .card-icon { position: absolute; top: 42px; right: 15px; font-size: 24px; color: #667eea; }
                .form-row { display: flex; gap: 20px; }
                .form-row .form-group { flex: 1; }
                .payment-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; margin-top: 20px; }
                .payment-error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 14px; text-align: center; }
                .payment-footer { padding: 0 30px 30px; display: flex; gap: 15px; }
                .btn-cancel-payment { flex: 1; background: #f44336; color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .btn-cancel-payment:hover { background: #d32f2f; }
                .btn-pay { flex: 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-pay:hover { opacity: 0.9; }
                .btn-pay.disabled { opacity: 0.6; pointer-events: none; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        const cardNumberInput = modal.querySelector('#cardNumber');
        const expiryDateInput = modal.querySelector('#expiryDate');
        const cvvInput = modal.querySelector('#cvv');
        const payBtn = modal.querySelector('#payBtn');
        const paymentError = modal.querySelector('#paymentError');
        const closeElements = modal.querySelectorAll('.close-payment, .btn-cancel-payment, .payment-overlay');

        // تنسيق رقم الكارت
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '').match(/.{1,4}/g);
            e.target.value = value ? value.join(' ') : '';
        });

        // تنسيق تاريخ الانتهاء
        expiryDateInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2, 4);
            e.target.value = value;
        });

        // إغلاق الـ modal
        closeElements.forEach(el => el.addEventListener('click', () => modal.remove()));

        // زر الدفع
        payBtn.addEventListener('click', async () => {
            paymentError.style.display = 'none';
            payBtn.disabled = true;
            payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

            const cardNumber = cardNumberInput.value.replace(/\s/g, '');
            const expiryDate = expiryDateInput.value;
            const cvv = cvvInput.value;

            if (!cardNumber || !expiryDate || !cvv) {
                paymentError.textContent = 'Please fill in all card details.';
                paymentError.style.display = 'block';
                payBtn.disabled = false;
                payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ${pricingInfo.totalPrice.toFixed(2)} EGP`;
                return;
            }

            try {
                const card = await HealthcareStorage.payment.verifyCard(cardNumber, expiryDate, cvv);
                if (!card) throw new Error('Invalid card details. Please check and try again.');

                const paymentResult = await HealthcareStorage.payment.processPayment(cardNumber, pricingInfo.totalPrice);
                if (!paymentResult.success) throw new Error(paymentResult.message || 'Payment failed.');

                paymentResult.cardNumber = cardNumber;

                console.log('💳 Payment successful:', paymentResult);
                modal.remove();
                onSuccess(paymentResult);

            } catch (err) {
                paymentError.textContent = err.message;
                paymentError.style.display = 'block';
                payBtn.disabled = false;
                payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ${pricingInfo.totalPrice.toFixed(2)} EGP`;
            }
        });
    }

  async function init() {
    try {
        allDoctors = await HealthcareStorage.users.getAllDoctors();

        const urlParams = new URLSearchParams(window.location.search);
        const isReschedule = urlParams.get('reschedule') === 'true';

        if (isReschedule) {
            const rescheduleData = JSON.parse(localStorage.getItem('rescheduleData') || '{}');
            console.log('📥 Loaded reschedule data:', rescheduleData);
            
            if (rescheduleData.appointmentId) {  // ⬅️ الاسم الصحيح
                appointmentData.specialty = rescheduleData.specialty;
                appointmentData.doctorId = rescheduleData.doctorId;
                appointmentData.doctorName = rescheduleData.doctorName;
                appointmentData.doctorPrice = rescheduleData.doctorPrice;
                appointmentData.reason = rescheduleData.reason || '';
                appointmentData.rescheduleId = rescheduleData.appointmentId; // ⬅️ هنا المشكلة!
                appointmentData.oldPaidAmount = rescheduleData.oldPaidAmount || 0;

                console.log('✅ Set rescheduleId to:', appointmentData.rescheduleId);

                renderSpecialties();
                renderDoctors();
                currentStep = 3;
                await setupDateTime();
                showToast(`Rescheduling with Dr. ${appointmentData.doctorName}`, 'info');
                localStorage.removeItem('rescheduleData');
            }
        } else {
            renderSpecialties();
        }

        updateStepUI();
    } catch (error) {
        console.error('Init error:', error);
        showError('Failed to load data. Please refresh.');
    }
}
    function showError(message) {
        pageErrorText.textContent = message;
        pageError.classList.add('show');
        setTimeout(() => pageError.classList.remove('show'), 6000);
    }

    function updateStepUI() {
        steps.forEach((s, i) => s.classList.toggle('active', i + 1 === currentStep));
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i + 1 === currentStep);
            ind.classList.toggle('completed', i + 1 < currentStep);
        });
        prevBtn.style.display = currentStep === 1 ? 'none' : 'flex';
        nextBtn.style.display = currentStep === 4 ? 'none' : 'flex';
        confirmBtn.style.display = currentStep === 4 ? 'flex' : 'none';
    }

    function renderSpecialties() {
        const specialties = [...new Set(allDoctors.map(d => d.specialty))].sort();
        specialtiesGrid.innerHTML = specialties.map(s => `
            <div class="specialty-card ${appointmentData.specialty === s ? 'selected' : ''}" onclick="selectSpecialty('${s}')">
                <div class="specialty-icon"><i class="fa-solid fa-stethoscope"></i></div>
                <h3>${s}</h3>
                <p>${allDoctors.filter(d => d.specialty === s).length} Doctors</p>
            </div>
        `).join('');
    }

    window.selectSpecialty = function(s) {
        appointmentData.specialty = s;
        appointmentData.doctorId = '';
        appointmentData.doctorName = '';
        appointmentData.doctorPrice = 0;
        appointmentData.date = '';
        appointmentData.readableDate = '';
        appointmentData.time = '';
        renderSpecialties();
        goToStep(2);
    };

    function renderDoctors() {
        const filtered = allDoctors.filter(d => d.specialty === appointmentData.specialty);
     doctorsGrid.innerHTML = filtered.map(d => `
    <div class="doctor-card ${appointmentData.doctorId === d.id ? 'selected' : ''}">
        <div class="doctor-image">
            <img src="${d.profileImg || '../../images/doctor-profile.png'}" alt="${d.fullname}">
        </div>
        <div class="doctor-details">
            <h3>Dr. ${d.fullname}</h3>
            <p class="doctor-specialty">${d.specialty}</p>
            <div class="doctor-info">
                <span><i class="fa-solid fa-money-bill"></i> ${d.appointmentPrice} EGP</span>
                <span><i class="fa-solid fa-briefcase-medical"></i> ${d.experience || 'N/A'} Years Experience</span>
            </div>
        </div>
        <button class="select-doctor-btn" onclick="selectDoctor('${d.id}', '${d.fullname}', ${d.appointmentPrice})">
            ${appointmentData.doctorId === d.id ? '✓ Selected' : 'Select Doctor'}
        </button>
    </div>
`).join('');
    }

    window.selectDoctor = function(id, name, price) {
        appointmentData.doctorId = id;
        appointmentData.doctorName = name;
        appointmentData.doctorPrice = parseFloat(price);
        appointmentData.date = '';
        appointmentData.readableDate = '';
        appointmentData.time = '';
        renderDoctors();
        goToStep(3);
    };
    async function setupDateTime() {
        const doctor = allDoctors.find(d => d.id === appointmentData.doctorId);
        if (!doctor || !doctor.workingHours || !doctor.workingHours.days.length) {
            quickDatesContainer.innerHTML = '<p class="error">No working schedule set.</p>';
            timeSlotsGrid.innerHTML = '';
            return;
        }

        const workingDays = doctor.workingHours.days;
        const startTime = doctor.workingHours.start;
        const endTime = doctor.workingHours.end === "00:00" ? "24:00" : doctor.workingHours.end;

        const bookedAppointments = await HealthcareStorage.appointments.getByDoctor(appointmentData.doctorId);

        quickDatesContainer.innerHTML = '';
        timeSlotsGrid.innerHTML = '<p>Select a date to view available times.</p>';

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });

        const availableDates = [];

        // Today if still available
        if (workingDays.includes(currentDayName)) {
            const [eh, em] = endTime.split(':').map(Number);
            const endToday = new Date(now);
            endToday.setHours(eh === 24 ? 23 : eh, em, 59, 999);
            if (now < endToday) {
                const readable = 'Today, ' + now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                availableDates.push({ dateStr: todayStr, readable });
            }
        }

        // Future 7 days
        let futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + 1);

        while (availableDates.length < 7) {
            const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
            if (workingDays.includes(dayName)) {
                const dateStr = futureDate.toISOString().split('T')[0];
                const readable = futureDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                availableDates.push({ dateStr, readable });
            }
            futureDate.setDate(futureDate.getDate() + 1);
        }

        availableDates.forEach(d => {
            const btn = document.createElement('button');
            btn.classList.add('quick-date-btn');
            btn.textContent = d.dateStr === todayStr ? 'Today' : new Date(d.dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (appointmentData.date === d.dateStr) btn.classList.add('selected');

            btn.onclick = () => {
                appointmentData.date = d.dateStr;
                appointmentData.readableDate = d.readable;
                appointmentData.time = '';
                document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                renderTimeSlots(bookedAppointments, doctor, d.dateStr, startTime, endTime, d.dateStr === todayStr);
            };

            quickDatesContainer.appendChild(btn);
        });
    }
async function renderTimeSlots(bookedAppointments, doctor, selectedDate, startTime, endTime, isToday = false) {
    timeSlotsGrid.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading available times...</p></div>';

    const now = new Date();
    const [sh, sm] = startTime.split(':').map(Number);
    let [eh, em] = endTime.split(':').map(Number);
    if (endTime === "24:00") eh = 24;

    let current = new Date(selectedDate);
    current.setHours(sh, sm, 0, 0);

    const end = new Date(selectedDate);
    end.setHours(eh, em, 0, 0);

    // تحقق من وجود موعد سابق في نفس اليوم مع نفس الدكتور (خارج الـ try عشان ما يرميش error)
    let hasExistingAppointment = false;
    let existingMessage = '';

    if (!appointmentData.rescheduleId && appointmentData.doctorId) {
        try {
            const patientAppointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);
            const patientConfirmedApps = patientAppointments.filter(app => app.status === 'confirmed');

            const conflictingApps = patientConfirmedApps.filter(app => {
                const appDate = new Date(app.dateTime).toDateString();
                const selectedDateObj = new Date(selectedDate).toDateString();
                return app.doctorId === appointmentData.doctorId &&
                       appDate === selectedDateObj &&
                       app.id !== appointmentData.rescheduleId;
            });

            if (conflictingApps.length > 0) {
                hasExistingAppointment = true;
                const existingApp = conflictingApps[0];
                const existingTime = new Date(existingApp.dateTime).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                });
                const doctorName = doctorsMap[appointmentData.doctorId]?.fullname || appointmentData.doctorName || 'this doctor';
                existingMessage = `You already have an appointment with Dr. ${doctorName} at ${existingTime} on this day.`;
            }
        } catch (error) {
            console.error('Error checking conflict:', error);
            // لو في خطأ في الجلب، نكمل عادي (مش نوقف الكود)
        }
    }

   // إظهار رسالة التعارض لو موجود
if (hasExistingAppointment) {
    timeSlotsGrid.innerHTML = `
        <div class="conflict-message">
            <div class="conflict-icon">
                <i class="fa-solid fa-calendar-xmark"></i>
            </div>
            <div class="conflict-text">
                <h3>You Already Have an Appointment!</h3>
                <p>${existingMessage}</p>
                <p>You cannot book more than one appointment with the same doctor on the same day.</p>
                <p>Please select a different date.</p>
            </div>
        </div>
    `;
    return;
}

    // لو مفيش تعارض، نكمل توليد الأوقات داخل try/catch
    try {
        // جلب مواعيد المريض مرة تانية لو محتاجين (أو نستخدم اللي فوق لو موجود)
        const patientAppointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);
        const patientConfirmedApps = patientAppointments.filter(app => app.status === 'confirmed');

        const doctorBookedTimes = bookedAppointments
            .filter(a => a.dateTime.startsWith(selectedDate) && a.status === 'confirmed')
            .map(a => a.dateTime.split('T')[1].slice(0, 5));

        const patientBookedTimesOnThisDay = patientConfirmedApps
            .filter(app => {
                const appDate = new Date(app.dateTime).toDateString();
                const selectedDateObj = new Date(selectedDate).toDateString();
                return appDate === selectedDateObj && app.id !== appointmentData.rescheduleId;
            })
            .map(app => app.dateTime.split('T')[1].slice(0, 5));

        timeSlotsGrid.innerHTML = '';

        while (current < end) {
            const timeValue = current.toTimeString().slice(0, 5);
            const timeDisplay = current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            if (isToday && current <= now) {
                current.setMinutes(current.getMinutes() + 30);
                continue;
            }

            const btn = document.createElement('button');
            btn.classList.add('time-slot');
            btn.textContent = timeDisplay;

            let isBooked = false;
            let bookedReason = '';

            if (doctorBookedTimes.includes(timeValue)) {
                isBooked = true;
                bookedReason = 'Already booked';
            } else if (patientBookedTimesOnThisDay.includes(timeValue)) {
                isBooked = true;
                bookedReason = 'You have another appointment at this time';
            }

            if (isBooked) {
                btn.classList.add('booked');
                btn.disabled = true;
                btn.title = bookedReason;
            } else {
                btn.onclick = () => {
                    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
                    btn.classList.add('selected');
                    appointmentData.time = timeDisplay;
                };
            }

            timeSlotsGrid.appendChild(btn);
            current.setMinutes(current.getMinutes() + 30);
        }

        if (timeSlotsGrid.children.length === 0) {
            timeSlotsGrid.innerHTML = '<p class="no-data">No available time slots for this date.</p>';
        }

    } catch (error) {
        console.error('Error rendering time slots:', error);
        timeSlotsGrid.innerHTML = '<p class="error">Failed to load time slots. Please try again.</p>';
    }
}
   function populateConfirmation() {
        document.getElementById('confirmSpecialty').textContent = appointmentData.specialty;
        document.getElementById('confirmDoctor').textContent = `Dr. ${appointmentData.doctorName}`;
        document.getElementById('confirmDate').textContent = appointmentData.readableDate;
        document.getElementById('confirmTime').textContent = appointmentData.time;
        document.getElementById('confirmReason').textContent = reasonTextarea.value.trim() || 'General consultation';
        appointmentData.reason = reasonTextarea.value.trim();
    }

    function goToStep(step) {
        currentStep = step;
        updateStepUI();
        if (step === 2) renderDoctors();
        if (step === 3) setupDateTime();
        if (step === 4) populateConfirmation();
    }

    prevBtn.addEventListener('click', () => goToStep(currentStep - 1));

    nextBtn.addEventListener('click', () => {
        let valid = true;
        let errorMessage = '';

        if (currentStep === 1 && !appointmentData.specialty) {
            valid = false;
            errorMessage = 'Please select a specialty.';
        } else if (currentStep === 2 && !appointmentData.doctorId) {
            valid = false;
            errorMessage = 'Please select a doctor.';
        } else if (currentStep === 3 && (!appointmentData.date || !appointmentData.time)) {
            valid = false;
            errorMessage = 'Please select a date and time slot.';
        }

        if (!valid) {
            showError(errorMessage);
            return;
        }

        goToStep(currentStep + 1);
    });

    // 🔧 استبدل confirmBtn.addEventListener بالكود ده

confirmBtn.addEventListener('click', async () => {
    if (!appointmentData.time) {
        showError('Please select a time slot.');
        return;
    }

    console.log('🎯 Confirm clicked. appointmentData:', appointmentData);
    console.log('🔍 rescheduleId:', appointmentData.rescheduleId);

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    const isoTime = convertToISO(appointmentData.time);
    const appointmentDateTime = `${appointmentData.date}T${isoTime}:00`;

    // ========================================
    // 🔧 RESCHEDULE MODE
    // ========================================
    if (appointmentData.rescheduleId) {
        console.log('🔄 RESCHEDULE MODE - ID:', appointmentData.rescheduleId);

        try {
            const payload = {
                dateTime: appointmentDateTime,
                time: appointmentData.time,
                readableDate: appointmentData.readableDate,
                reason: appointmentData.reason || 'General consultation',
                updatedAt: new Date().toISOString()
            };

            console.log('📤 PATCH to /appointments/' + appointmentData.rescheduleId);
            console.log('📤 Payload:', payload);

            const response = await fetch(`http://localhost:3000/appointments/${appointmentData.rescheduleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`PATCH failed (${response.status}): ${errorText}`);
            }

            const updated = await response.json();
            console.log('✅ Updated:', updated);

            showToast('✅ Appointment rescheduled successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'my-appointments.html';
            }, 1500);

        } catch (error) {
            console.error('❌ Reschedule error:', error);
            showToast(error.message || 'Failed to reschedule.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Appointment';
        }
    }
    // ========================================
    // 💳 NEW BOOKING
    // ========================================
    else {
        console.log('💳 NEW BOOKING MODE');

        try {
            const pricingInfo = { totalPrice: appointmentData.doctorPrice };

            showPaymentModal(appointmentData, pricingInfo, async (paymentResult) => {
                try {
                    const payload = {
                        patientId: currentUser.id,
                        doctorId: appointmentData.doctorId,
                        dateTime: appointmentDateTime,
                        time: appointmentData.time,
                        readableDate: appointmentData.readableDate,
                        reason: appointmentData.reason || 'General consultation',
                        basePrice: appointmentData.doctorPrice,
                        paidAmount: appointmentData.doctorPrice,
                        status: 'confirmed',
                        paymentCardNumber: paymentResult.cardNumber || '',
                        createdAt: new Date().toISOString()
                    };

                    console.log('📤 POST Payload:', payload);

                    const response = await fetch('http://localhost:3000/appointments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`POST failed: ${response.status}`);
                    }

                    const created = await response.json();
                    console.log('✅ Created:', created);

                    showToast('✅ Appointment booked successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = 'my-appointments.html';
                    }, 1500);

                } catch (error) {
                    console.error('❌ Booking error:', error);
                    showToast(error.message || 'Failed to book.', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Appointment';
                }
            });

        } catch (error) {
            console.error('❌ Payment modal error:', error);
            showToast(error.message || 'An error occurred.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Appointment';
        }
    }
});

    function convertToISO(timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)?/i);
        if (!match) return '09:00';
        let h = parseInt(match[1], 10);
        const m = match[2];
        if (h === 12) h = match[3]?.toUpperCase() === 'AM' ? 0 : 12;
        else if (match[3]?.toUpperCase() === 'PM') h += 12;
        return `${h.toString().padStart(2, '0')}:${m}`;
    }

    init();
});