// js/Doctor/My Schedule.js

document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') {
        window.location.href = '../Auth/login.html';
        return;
    }

    const scheduleContainer = document.getElementById('detailed-schedule');
    const filterBtns = document.querySelectorAll('.filter-btn');

    if (!scheduleContainer) return;

    let selectedDate = new Date();
    let currentStatusFilter = 'all';
    let allAppointments = [];
    let doctorData = null;

    async function init() {
        try {
            doctorData = await HealthcareStorage.users.getById(currentUser.id);
            allAppointments = await HealthcareStorage.doctor.getAppointments(currentUser.id);
            window.allDoctorAppointments = allAppointments; // For calendar
            loadSelectedDateSchedule();
        } catch (error) {
            console.error('Failed to load schedule:', error);
            scheduleContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted)">Failed to load appointments</p>';
        }
    }

    async function loadSelectedDateSchedule() {
        const isSameDay = (d1, d2) => {
            const date1 = new Date(d1);
            const date2 = new Date(d2);
            return date1.getFullYear() === date2.getFullYear() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getDate() === date2.getDate();
        };

        // Filter appointments for selected date
        const dayAppointments = allAppointments.filter(a =>
            isSameDay(a.dateTime, selectedDate) && a.status !== 'cancelled'
        );

        // Update title
        const titleEl = document.getElementById('timeline-title');
        const today = new Date();
        const isToday = isSameDay(selectedDate, today);
        if (titleEl) {
            titleEl.innerHTML = isToday
                ? '<i class="fa-solid fa-calendar-day"></i> Today\'s Appointments'
                : `<i class="fa-solid fa-calendar-day"></i> ${selectedDate.toLocaleDateString()} Appointments`;
        }

        await renderTimeline(dayAppointments);
    }

    async function renderTimeline(appointments) {
        // Apply status filter
        let filteredAppts = appointments;
        if (currentStatusFilter === 'confirmed') {
            filteredAppts = appointments.filter(a => a.status.toLowerCase() === 'confirmed');
        } else if (currentStatusFilter === 'completed') {
            filteredAppts = appointments.filter(a => a.status.toLowerCase() === 'completed');
        }

        if (filteredAppts.length === 0) {
            scheduleContainer.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted)">No ${currentStatusFilter !== 'all' ? currentStatusFilter : ''} appointments found for this date</p>`;
            return;
        }

        // Sort by time
        filteredAppts.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // Fetch patient data
        const patientIds = [...new Set(filteredAppts.map(a => a.patientId))];
        const patientsData = await Promise.all(patientIds.map(id => HealthcareStorage.users.getById(id)));
        const patientsMap = Object.fromEntries(patientsData.map(p => [p.id, p]));

        // Render appointments
        scheduleContainer.innerHTML = filteredAppts.map(appt => {
            const patient = patientsMap[appt.patientId] || { fullname: 'Unknown Patient' };
            // Format Time (12h)
            const apptTime = new Date(appt.dateTime);
            const hour = apptTime.getHours() % 12 || 12;
            const minutes = apptTime.getMinutes().toString().padStart(2, '0');
            const ampm = apptTime.getHours() >= 12 ? 'PM' : 'AM';
            const timeStr = `${hour}:${minutes}`;

            const now = new Date();
            const canComplete = apptTime <= now;

            const status = appt.status.toLowerCase();
            let actionBtn = '';

            if (status === 'confirmed') {
                if (canComplete) {
                    actionBtn = `<button class="action-btn btn-confirm complete-visit-btn" data-id="${appt.id}" title="Complete Visit"><i class="fa-solid fa-circle-check"></i> Complete</button>`;
                } else {
                    actionBtn = `<span class="status-badge" style="background: rgba(106, 94, 253, 0.1); color: var(--primary); opacity: 0.6;" title="Cannot complete until visit time"><i class="fa-solid fa-clock"></i> Upcoming</span>`;
                }
            }

            return `
                <div class="appt-item-detailed" style="margin-bottom: 16px;">
                    <div class="time-box">
                        <h4>${timeStr}</h4>
                        <span>${ampm}</span>
                    </div>
                    <div class="patient-info">
                        <b>${patient.fullname}</b>
                        <p>${appt.reason || 'General Checkup'}</p>
                    </div>
                    <div class="appt-actions">
                        <span class="status-badge status-${status}">${appt.status}</span>
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for complete buttons
        document.querySelectorAll('.complete-visit-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const apptId = btn.dataset.id;
                const appt = allAppointments.find(a => a.id == apptId);

                if (appt && new Date(appt.dateTime) > new Date()) {
                    if (window.showToast) showToast('Cannot complete a visit that hasn\'t started yet!', 'error');
                    return;
                }

                if (confirm('Mark this visit as completed?')) {
                    try {
                        await HealthcareStorage.appointments.updateStatus(apptId, 'completed');
                        if (window.showToast) showToast('Visit completed successfully!', 'success');

                        // Refresh appointments
                        allAppointments = await HealthcareStorage.doctor.getAppointments(currentUser.id);
                        window.allDoctorAppointments = allAppointments;
                        loadSelectedDateSchedule();
                    } catch (error) {
                        console.error('Failed to update appointment:', error);
                        if (window.showToast) showToast('Failed to update appointment', 'error');
                    }
                }
            });
        });
    }

    // Event Listeners
    window.addEventListener('dateSelected', (e) => {
        selectedDate = e.detail.date;
        loadSelectedDateSchedule();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.status;
            loadSelectedDateSchedule();
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

    init();
});