window.addEventListener('load', async () => {
    // Auth Guard
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') {
        window.location.href = '../../html/Auth/login.html';
        return;
    }

    const appointmentsGrid = document.querySelector('.appointments-grid');
    const reminderCard = document.querySelector('.reminder-card');
    const statValues = document.querySelectorAll('.stat-info h3'); //  stats
    let allAppointments = [];
    let doctorsMap = {};

    // View Appointment Details
    window.viewAppointmentDetails = async function(appointmentId) {
        try {
            const numericId = parseInt(appointmentId, 10);
            const appointment = allAppointments.find(app => app.id === numericId);
            if (!appointment) {
                showToast('Appointment not found.', 'error');
                return;
            }

            const doctor = doctorsMap[appointment.doctorId] || { fullname: 'Unknown Doctor', specialty: 'General' };

            const date = new Date(appointment.dateTime);
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            document.getElementById('modalDoctor').textContent = `Dr. ${doctor.fullname}`;
            document.getElementById('modalSpecialty').textContent = doctor.specialty;
            document.getElementById('modalDate').textContent = dateStr;
            document.getElementById('modalTime').textContent = timeStr;
            document.getElementById('modalReason').textContent = appointment.reason || 'General consultation';

            const statusSpan = document.getElementById('modalStatus');
            statusSpan.textContent = appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1);
            statusSpan.className = `status-badge status-${appointment.status}`;

            document.getElementById('appointmentModal').style.display = 'flex';

        } catch (error) {
            console.error('Error in viewAppointmentDetails:', error);
            showToast('Failed to load appointment details.', 'error');
        }
    };

    // Close Modal
    window.closeAppointmentModal = function() {
        document.getElementById('appointmentModal').style.display = 'none';
    };

    window.onclick = function(event) {
        const modal = document.getElementById('appointmentModal');
        if (event.target === modal) {
            closeAppointmentModal();
        }
    };

    // Load Dashboard
    try {
        allAppointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);
        const doctors = await HealthcareStorage.users.getAllDoctors();
        doctorsMap = Object.fromEntries(doctors.map(d => [d.id, d]));

        const now = new Date();

        // Upcoming: confirmed وفي المستقبل
        const upcomingList = allAppointments
            .filter(app => app.status === 'confirmed' && new Date(app.dateTime) > now)
            .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

        // Stats
        const totalAppointments = allAppointments.length;
        const upcomingCount = upcomingList.length;
        const completedCount = allAppointments.filter(app => app.status === 'completed').length;
        const uniqueDoctors = new Set(allAppointments.map(app => app.doctorId)).size;

        if (statValues.length >= 4) {
            statValues[0].textContent = totalAppointments;
            statValues[1].textContent = upcomingCount;
            statValues[2].textContent = completedCount; // Medical Records = completed appointments
            statValues[3].textContent = uniqueDoctors;
        }

        // Upcoming Appointments Grid
        if (upcomingList.length === 0) {
            appointmentsGrid.innerHTML = '<p class="no-data">No upcoming appointments.</p>';
        } else {
            appointmentsGrid.innerHTML = upcomingList.slice(0, 3).map(app => {
                const doctor = doctorsMap[app.doctorId] || { fullname: 'Unknown Doctor', specialty: 'N/A' };
                const date = new Date(app.dateTime);
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                return `
                    <div class="appointment-card">
                        <div class="appointment-header">
                            <div class="appointment-date">
                                <h4>${dateStr}</h4>
                                <p class="appointment-time"><i class="fa-regular fa-clock"></i> ${timeStr}</p>
                            </div>
                            <span class="status-badge status-confirmed">Confirmed</span>
                        </div>
                        <div class="doctor-info">
                            <h5><i class="fa-solid fa-user-doctor"></i> Dr. ${doctor.fullname}</h5>
                            <p class="specialty"><i class="fa-solid fa-stethoscope"></i> ${doctor.specialty}</p>
                        </div>
                        <button class="card-action-btn" data-appointment-id="${app.id}">
                            <i class="fa-solid fa-eye"></i> View Details
                        </button>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.card-action-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = this.getAttribute('data-appointment-id');
                    viewAppointmentDetails(id);
                });
            });
        }

        // Reminder Card
        if (reminderCard) {
            if (upcomingList.length > 0) {
                const nextApp = upcomingList[0];
                const date = new Date(nextApp.dateTime);
                const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                const dayStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

                const doc = doctorsMap[nextApp.doctorId] || { fullname: 'your doctor' };

                reminderCard.querySelector('.reminder-text').textContent = 
                    `You have a confirmed appointment with Dr. ${doc.fullname} on ${dayStr} at ${timeStr}.`;

                const viewBtn = reminderCard.querySelector('.view-details-btn');
                if (viewBtn) {
                    viewBtn.onclick = (e) => {
                        e.preventDefault();
                        viewAppointmentDetails(nextApp.id);
                    };
                }

                reminderCard.style.display = 'block';
            } else {
                reminderCard.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
        appointmentsGrid.innerHTML = '<p class="no-data">Error loading appointments. Please refresh.</p>';
    }
});