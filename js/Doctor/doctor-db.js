document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Current User Data
    const currentUser = HealthcareStorage.auth.getCurrentUser();

    if (!currentUser || currentUser.role !== 'doctor') {
        window.location.href = '/html/Auth/login.html';
        return;
    }

    // 2. Initial UI Update (using local data first)
    const updateUI = (user) => {
        if (!user) return;

        const doctorNameElements = document.querySelectorAll('.user-name, #doctor-name');
        const profileImages = document.querySelectorAll('.profile-img, .profile-img-container img, .welcome-card + .profile-img');

        let fullName = user.fullname || 'Doctor';
        let cleanName = fullName.toLowerCase().startsWith('dr. ') ? fullName.substring(4) : fullName;
        let firstName = cleanName.split(' ')[0];

        doctorNameElements.forEach(el => {
            if (el.id === 'doctor-name') {
                el.textContent = fullName.toLowerCase().startsWith('dr. ') ? fullName : `Dr. ${fullName}`;
            } else {
                el.textContent = `Dr. ${firstName}`;
            }
        });

        if (user.profileImg) {
            profileImages.forEach(img => {
                img.src = user.profileImg;
                img.onerror = () => { img.src = '/images/doctor-profile.png'; };
            });
        }
    };

    updateUI(currentUser);

    // 3. Refresh user data from server to ensure sync
    try {
        const refreshedUser = await HealthcareStorage.users.getById(currentUser.id);
        if (refreshedUser) {
            currentUser.fullname = refreshedUser.fullname;
            currentUser.profileImg = refreshedUser.profileImg;
            currentUser.specialty = refreshedUser.specialty;
            localStorage.setItem('healthcare_current_user', JSON.stringify(currentUser));
            updateUI(currentUser);
        }
    } catch (e) {
        console.warn('Failed to refresh user data from server:', e);
    }

    // 4. Handle New Prescription - Dynamic Medications
    const prescForm = document.getElementById('prescription-form');
    const medContainer = document.getElementById('medications-container');
    const addMedBtn = document.getElementById('add-med-btn');

    if (addMedBtn && medContainer) {
        addMedBtn.addEventListener('click', () => {
            const newRow = document.createElement('div');
            newRow.className = 'medication-item';
            newRow.style = 'border-bottom: 1px dashed var(--border); padding-bottom: 15px; margin-bottom: 15px; position: relative;';
            newRow.innerHTML = `
                <button type="button" class="remove-med-btn" style="position: absolute; right: 0; top: 0; color: #ef4444; border: none; background: none; cursor: pointer;">
                    <i class="fa-solid fa-circle-xmark"></i>
                </button>
                <div class="form-group">
                    <label>Medication</label>
                    <input type="text" class="med-name" placeholder="e.g., Ibuprofen 200mg" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Dosage</label>
                        <input type="text" class="dosage" placeholder="1 tablet" required>
                    </div>
                    <div class="form-group">
                        <label>Frequency</label>
                        <select class="freq">
                            <option>Once daily</option>
                            <option>Twice daily</option>
                            <option>Three times daily</option>
                            <option>Four times daily</option>
                            <option>Every 8 hours</option>
                            <option>As needed</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>Special Instructions</label>
                    <input type="text" class="instructions" placeholder="e.g., After meals, avoid driving">
                </div>
            `;
            medContainer.appendChild(newRow);

            const removeBtn = newRow.querySelector('.remove-med-btn');
            if (removeBtn) removeBtn.addEventListener('click', () => newRow.remove());
        });
    }

    let patients = [];

    try {
        const isSameDay = (d1, d2) => {
            const date1 = new Date(d1);
            const date2 = new Date(d2);
            return date1.getFullYear() === date2.getFullYear() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getDate() === date2.getDate();
        };

        // Fetch Real Data from Server
        const [allPatients, allAppointments, prescriptions] = await Promise.all([
            HealthcareStorage.doctor.getAllPatients(),
            HealthcareStorage.doctor.getAppointments(currentUser.id),
            HealthcareStorage.doctor.getPrescriptions(currentUser.id)
        ]);

        const myPatientIds = [...new Set(allAppointments.map(a => a.patientId))];
        patients = allPatients.filter(p => myPatientIds.includes(p.id));

        const now = new Date();
        const schedule = allAppointments
            .filter(a => a.status !== 'cancelled')
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // 1. Update stats and revenue immediately (with full appointment list)
        updateStats(patients, allAppointments, prescriptions);

        // 2. Filter today's appointments for initial display
        const today = new Date();
        const todayAppointments = allAppointments
            .filter(a => {
                const apptDate = new Date(a.dateTime);
                return isSameDay(apptDate, today) && a.status !== 'cancelled';
            })
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // 3. Render UI lists
        renderPatients(patients);
        renderSchedule(todayAppointments, allPatients);

        window.allTodayAppointments = todayAppointments;
        window.allDoctorAppointments = allAppointments;

        // Handle New Prescription Form
        if (prescForm) {
            const patientSelect = document.getElementById('patient-select');
            if (patientSelect) {
                // Only show patients with completed appointments
                const completedAppointments = allAppointments.filter(a => a.status === 'completed');
                const completedPatientIds = [...new Set(completedAppointments.map(a => a.patientId))];
                const completedPatients = patients.filter(p => completedPatientIds.includes(p.id));

                patientSelect.innerHTML = '<option value="">Select Patient (Completed Visits Only)</option>' +
                    completedPatients.map(p => `<option value="${p.id}">${p.fullname}</option>`).join('');
            }

            prescForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const patientId = document.getElementById('patient-select').value;
                if (!patientId) {
                    if (window.showToast) showToast('Please select a patient', 'error');
                    return;
                }

                // Check if patient has completed appointment
                const hasCompletedAppt = allAppointments.some(a =>
                    a.patientId === patientId && a.status === 'completed'
                );

                if (!hasCompletedAppt) {
                    if (window.showToast) showToast('Can only prescribe for completed appointments', 'error');
                    return;
                }

                // Get the completed appointment
                const completedAppt = allAppointments.find(a =>
                    a.patientId === patientId && a.status === 'completed'
                );

                // Collect all medications
                const medItems = medContainer.querySelectorAll('.medication-item');
                const medicationsList = [];
                medItems.forEach(item => {
                    medicationsList.push({
                        medication: item.querySelector('.med-name').value,
                        dosage: item.querySelector('.dosage').value,
                        frequency: item.querySelector('.freq').value,
                        instructions: item.querySelector('.instructions').value.trim()
                    });
                });

                if (medicationsList.length === 0) {
                    if (window.showToast) showToast('Please add at least one medication', 'error');
                    return;
                }

                try {
                    // Create prescriptions and medical records for each medication
                    for (const med of medicationsList) {
                        // Add to prescriptions table
                        const prescriptionData = {
                            patientId: patientId,
                            doctorId: currentUser.id,
                            appointmentId: completedAppt.id,
                            medication: med.medication,
                            dosage: med.dosage,
                            frequency: med.frequency,
                            instructions: med.instructions,
                            date: new Date().toISOString(),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        await HealthcareStorage.prescriptions.create(prescriptionData);

                        // Add to medical_records table
                        const medicalRecordData = {
                            patientId: patientId,
                            doctorId: currentUser.id,
                            appointmentId: completedAppt.id,
                            date: new Date().toISOString().split('T')[0],
                            diagnosis: 'Prescription issued',
                            notes: '',
                            medication: med.medication,
                            dosage: med.dosage,
                            frequency: med.frequency,
                            instructions: med.instructions,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        await HealthcareStorage.medicalRecords.create(medicalRecordData);
                    }

                    if (window.showToast) showToast('Prescription issued successfully!', 'success');

                    // Reset form
                    prescForm.reset();
                    medContainer.innerHTML = `
                        <div class="medication-item" style="border-bottom: 1px dashed var(--border); padding-bottom: 15px; margin-bottom: 15px;">
                            <div class="form-group">
                                <label>Medication</label>
                                <input type="text" class="med-name" placeholder="e.g., Ibuprofen 200mg" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Dosage</label>
                                    <input type="text" class="dosage" placeholder="1 tablet" required>
                                </div>
                                    <div class="form-group" style="margin-top: 10px;">
                                        <label>Special Instructions</label>
                                        <input type="text" class="instructions" placeholder="e.g., After meals, avoid driving">
                                    </div>
                                </div>
                            </div>
                        `;

                    const updatedPrescriptions = await HealthcareStorage.doctor.getPrescriptions(currentUser.id);
                    updateStats(patients, schedule, updatedPrescriptions);
                } catch (error) {
                    console.error('Error creating prescription:', error);
                    if (window.showToast) showToast('Failed to create prescription', 'error');
                }
            });
        }
    } catch (error) {
        console.error('Error loading doctor dashboard:', error);
        if (window.showToast) showToast('Failed to load dashboard data. Please check connection.', 'error');
    }

    // Today's Schedule Filters
    const filterTodayBtns = document.querySelectorAll('.schedule-filters .filter-btn');
    if (filterTodayBtns.length > 0) {
        filterTodayBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterTodayBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (window.allTodayAppointments) {
                    renderSchedule(window.allTodayAppointments, btn.dataset.status);
                }
            });
        });
    }

    // Patient Details Modal
    const modal = document.getElementById('patientModal');
    const closeModal = document.querySelector('.close-modal');

    async function showPatientDetails(id) {
        if (!patients || patients.length === 0) return;

        const patient = patients.find(p => p.id === id);
        if (!patient) return;

        // Calculate age from dateOfBirth
        let age = '--';
        if (patient.dateOfBirth) {
            const birthDate = new Date(patient.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        // UI Updates
        document.getElementById('detail-img').src = patient.profileImg || '../../images/patient-profile.png';
        document.getElementById('detail-name').textContent = patient.fullname;
        document.getElementById('detail-id').textContent = `ID: #${patient.id.toString().slice(-4).toUpperCase()}`;
        document.getElementById('detail-age').textContent = `Age: ${age}`;
        document.getElementById('detail-phone').textContent = `Phone: ${patient.phone || '--'}`;
        document.getElementById('detail-email').textContent = `Email: ${patient.email || '--'}`;

        // Medical History (array to string)
        const historyText = Array.isArray(patient.medicalHistory) && patient.medicalHistory.length > 0
            ? patient.medicalHistory.join(', ')
            : 'No medical history recorded.';
        document.getElementById('detail-history').textContent = historyText;

        try {
            // Fetch last medical record
            const records = await HealthcareStorage.medicalRecords.getByPatient(id);
            const lastRecord = records.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            if (lastRecord) {
                document.getElementById('last-record-date').textContent = `Date: ${new Date(lastRecord.date).toLocaleDateString()}`;
                document.getElementById('last-record-diagnosis').textContent = lastRecord.diagnosis;
            } else {
                document.getElementById('last-record-date').textContent = 'Date: --';
                document.getElementById('last-record-diagnosis').textContent = 'No previous records found.';
            }
        } catch (e) { console.warn('Medical records fetch failed', e); }

        // Links
        document.getElementById('call-link').href = `tel:${patient.phone}`;
        document.getElementById('whatsapp-link').href = `https://wa.me/${patient.phone?.replace(/\s/g, '')}`;

        modal.style.display = 'block';
    }

    if (closeModal) closeModal.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    document.getElementById('patients-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-patient-btn');
        if (btn) {
            showPatientDetails(btn.dataset.id);
        }
    });

    // Complete Visit Button
    document.getElementById('schedule-list')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.confirm-visit-btn');
        if (btn) {
            const apptId = btn.dataset.id;
            const appt = window.allTodayAppointments.find(a => a.id == apptId);

            if (appt && new Date(appt.dateTime) > new Date()) {
                if (window.showToast) showToast('Cannot complete a visit that hasn\'t started yet!', 'error');
                return;
            }

            if (confirm('Mark visit as completed?')) {
                try {
                    await HealthcareStorage.appointments.updateStatus(apptId, 'completed');
                    if (window.showToast) showToast('Visit completed!', 'success');

                    const refreshedAppts = await HealthcareStorage.doctor.getAppointments(currentUser.id);
                    await renderSchedule(refreshedAppts);
                } catch (e) {
                    console.error('Update failed', e);
                }
            }
        }
    });

    // Calendar
    window.addEventListener('dateSelected', async (e) => {
        const selectedDate = e.detail.date;
        const today = new Date();
        const isSameDay = (d1, d2) => {
            const date1 = new Date(d1);
            const date2 = new Date(d2);
            return date1.getFullYear() === date2.getFullYear() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getDate() === date2.getDate();
        };
        const isToday = isSameDay(selectedDate, today);

        const scheduleHeading = document.querySelector('.schedule-card .card-header h3');
        if (scheduleHeading) {
            scheduleHeading.textContent = isToday ? "Today's Schedule" : `${selectedDate.toLocaleDateString()} Schedule`;
        }

        let activeAppointments = window.allDoctorAppointments || [];
        if (activeAppointments.length === 0) {
            try {
                activeAppointments = await HealthcareStorage.doctor.getAppointments(currentUser.id);
                window.allDoctorAppointments = activeAppointments;
            } catch (e) { console.error(e); }
        }

        const dayAppointments = activeAppointments
            .filter(a => isSameDay(a.dateTime, selectedDate) && a.status !== 'cancelled')
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        window.allTodayAppointments = dayAppointments;
        renderSchedule(dayAppointments);

        const filterTodayBtns = document.querySelectorAll('.schedule-filters .filter-btn');
        filterTodayBtns.forEach(b => {
            b.classList.remove('active');
            if (b.dataset.status === 'all') b.classList.add('active');
        });
    });

    // Logout
    const logoutBtn = document.querySelector('.sidebar-footer .nav-item[data-tooltip="Logout"]');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            HealthcareStorage.auth.logout();
        });
    }
});

function renderPatients(data) {
    const table = document.getElementById('patients-list');
    if (table) {
        if (data.length === 0) {
            table.innerHTML = '<tr><td colspan="3" style="text-align:center">No patients found</td></tr>';
            return;
        }
        table.innerHTML = data.slice(0, 5).map(p => `
            <tr>
                <td>${p.id.toString().slice(-4).toUpperCase()}</td>
                <td>${p.fullname}</td>
                <td><button class="icon-btn view-patient-btn" data-id="${p.id}" style="font-size:14px"><i class="fa-solid fa-eye"></i></button></td>
            </tr>
        `).join('');
    }
}

function renderSchedule(data, allPatientsData = null, filter = 'all') {
    const list = document.getElementById('schedule-list');
    if (list) {
        let filteredData = data;
        if (filter === 'confirmed') {
            filteredData = data.filter(a => a.status.toLowerCase() === 'confirmed');
        } else if (filter === 'completed') {
            filteredData = data.filter(a => a.status.toLowerCase() === 'completed');
        }

        if (filteredData.length === 0) {
            list.innerHTML = `<p style="padding:20px; text-align:center; color:var(--text-muted)">No ${filter !== 'all' ? filter : ''} appointments found</p>`;
            return;
        }

        const patientsMap = allPatientsData ?
            Object.fromEntries(allPatientsData.map(p => [p.id, p])) :
            {};

        list.innerHTML = filteredData.slice(0, 5).map(s => {
            const patient = patientsMap[s.patientId] || { fullname: 'Patient' };
            const status = s.status.toLowerCase();
            const apptTime = new Date(s.dateTime);
            const now = new Date();
            const canComplete = apptTime <= now;

            // Format Time (12h)
            const hour = apptTime.getHours() % 12 || 12;
            const minutes = apptTime.getMinutes().toString().padStart(2, '0');
            const ampm = apptTime.getHours() >= 12 ? 'PM' : 'AM';
            const timeStr = `${hour}:${minutes}`;

            const actionBtn = (status === 'confirmed' && canComplete) ?
                `<button class="icon-btn confirm-visit-btn" data-id="${s.id}" title="Complete Visit" style="margin-left: 10px; color: var(--primary); font-size: 14px;"><i class="fa-solid fa-check"></i></button>` : '';

            return `
                <div class="appt-item">
                    <div class="time-column" style="display: flex; flex-direction: column; align-items: center; min-width: 80px; margin-right: 15px;">
                        <span class="time-tag" style="min-width: auto; font-size: 18px;">${timeStr}</span>
                        <span class="ampm-tag" style="font-size: 10px; font-weight: 700; color: var(--text-muted); opacity: 0.8;">${ampm}</span>
                    </div>
                    <div style="flex:1">
                        <b>${patient.fullname}</b>
                        <br><small style="color:var(--text-muted)">${s.reason || 'General Checkup'}</small>
                    </div>
                    <span class="status-badge status-${status.replace(' ', '-')}">${s.status}</span>
                    ${actionBtn}
                </div>
            `;
        }).join('');
    }
}

function updateStats(patients, appointments, prescriptions) {
    const today = new Date();

    const isToday = (dateStr) => {
        const d = new Date(dateStr);
        return d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate();
    };

    const todayAppts = appointments.filter(a => isToday(a.dateTime));

    if (document.getElementById('count-today-patients')) {
        const uniquePatientsToday = new Set(todayAppts.map(a => a.patientId)).size;
        document.getElementById('count-today-patients').innerText = uniquePatientsToday;
    }

    if (document.getElementById('count-confirmed')) {
        const confirmedToday = todayAppts.filter(a => a.status.toLowerCase() === 'confirmed').length;
        document.getElementById('count-confirmed').innerText = confirmedToday;
    }

    if (document.getElementById('count-completed-today')) {
        const completedToday = todayAppts.filter(a => a.status.toLowerCase() === 'completed').length;
        document.getElementById('count-completed-today').innerText = completedToday;
    }

    const nextAppTime = document.getElementById('next-app-time');
    if (nextAppTime) {
        const now = new Date();
        const upcomingApps = todayAppts
            .filter(a => new Date(a.dateTime) > now && (a.status.toLowerCase() === 'confirmed' || a.status.toLowerCase() === 'pending'))
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        if (upcomingApps.length > 0) {
            const nextApptDate = new Date(upcomingApps[0].dateTime);
            const hour = nextApptDate.getHours() % 12 || 12;
            const minutes = nextApptDate.getMinutes().toString().padStart(2, '0');
            const ampm = nextApptDate.getHours() >= 12 ? 'PM' : 'AM';
            nextAppTime.innerText = `${hour}:${minutes} ${ampm}`;
            nextAppTime.style.fontSize = '';
        } else {
            if (todayAppts.length > 0) {
                nextAppTime.innerText = 'Finished';
            } else {
                nextAppTime.innerText = 'None';
            }
            nextAppTime.style.fontSize = '14px';
        }
    }

    calculateRevenue(appointments);
}

function calculateRevenue(appointments) {
    try {
        const completedAppointments = appointments.filter(
            a => a.status && a.status.toLowerCase() === 'completed'
        );

        let totalRevenueGenerated = 0;
        completedAppointments.forEach(appt => {
            // Use paidAmount if available, otherwise fallback to basePrice or 0
            const amount = appt.paidAmount || appt.basePrice || 0;
            totalRevenueGenerated += amount;
        });

        const totalDoctorEarnings = totalRevenueGenerated * 0.8;
        const totalPlatformRevenue = totalRevenueGenerated * 0.2;

        if (document.getElementById('doctor-earnings')) {
            document.getElementById('doctor-earnings').textContent = `EGP ${totalDoctorEarnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        if (document.getElementById('hospital-earnings')) {
            document.getElementById('hospital-earnings').textContent = `EGP ${totalPlatformRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        if (document.getElementById('total-revenue')) {
            document.getElementById('total-revenue').textContent = `EGP ${totalRevenueGenerated.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
    } catch (error) {
        console.error('Error calculating revenue:', error);
    }
}
