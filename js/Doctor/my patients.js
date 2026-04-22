// js/Doctor/my patients.js

document.addEventListener('DOMContentLoaded', async () => {
    const patientsList = document.getElementById('full-patients-list');
    const searchInput = document.getElementById('patientSearch');
    const paginationContainer = document.getElementById('pagination');
    const modal = document.getElementById('patientModal');
    const closeModal = document.querySelector('.close-modal');

    if (!patientsList) return;

    let patients = [];
    let allAppointments = [];
    let currentPage = 1;
    const itemsPerPage = 6;

    async function loadData() {
        try {
            const currentUser = HealthcareStorage.auth.getCurrentUser();
            // Fetch both patients and ALL appointments to find "Last Appointment"
            const [patientsData, appointmentsData] = await Promise.all([
                HealthcareStorage.doctor.getAllPatients(),
                HealthcareStorage.appointments.getAll()
            ]);

            patients = patientsData;
            allAppointments = appointmentsData;

            // Filter: Only patients of THIS doctor
            const myPatientIds = [...new Set(allAppointments.filter(a => a.doctorId === currentUser.id).map(a => a.patientId))];
            patients = patients.filter(p => myPatientIds.includes(p.id));

            displayPatients();
        } catch (error) {
            console.error('Error loading patients:', error);
            patientsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444;">Error loading data</td></tr>`;
        }
    }

    function displayPatients() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = patients.filter(p =>
            p.fullname.toLowerCase().includes(searchTerm) ||
            p.id.toString().toLowerCase().includes(searchTerm)
        );

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = 1;

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = filtered.slice(start, end);

        if (pageItems.length === 0) {
            patientsList.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No patients found</td></tr>`;
            paginationContainer.innerHTML = '';
            return;
        }

        patientsList.innerHTML = pageItems.map(p => {
            // Calculate age from dateOfBirth
            let age = '--';
            if (p.dateOfBirth) {
                const birthDate = new Date(p.dateOfBirth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            // Find last appointment for THIS doctor and THIS patient
            const currentUser = HealthcareStorage.auth.getCurrentUser();
            const lastApp = allAppointments
                .filter(a => a.patientId === p.id && a.doctorId === currentUser.id && a.status.toLowerCase() === 'completed')
                .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0];

            const lastAppDate = lastApp ? new Date(lastApp.dateTime).toLocaleDateString() : 'No past visits';

            return `
                <tr>
                    <td>${p.id.toString().slice(-4).toUpperCase()}</td>
                    <td><strong>${p.fullname}</strong></td>
                    <td>${age}</td>
                    <td>${lastAppDate}</td>
                    <td>${p.phone || '--'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="icon-btn view-btn" data-id="${p.id}" title="View Details"><i class="fa-solid fa-eye"></i></button>
                            <a href="tel:${p.phone}" class="icon-btn call-btn" title="Call"><i class="fa-solid fa-phone"></i></a>
                            <a href="https://wa.me/${p.phone?.replace(/\s/g, '')}" target="_blank" class="icon-btn wa-btn" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        renderPagination(filtered.length);
        bindEvents();
    }

    function renderPagination(totalItems) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginationContainer.innerHTML = html;

        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                displayPatients();
            });
        });
    }

    function bindEvents() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const patientId = btn.dataset.id;
                showPatientDetails(patientId);
            });
        });
    }

    async function showPatientDetails(id) {
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

        // Fetch last medical record for this patient
        const records = await HealthcareStorage.medicalRecords.getByPatient(id);
        const lastRecord = records.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (lastRecord) {
            document.getElementById('last-record-date').textContent = `Date: ${new Date(lastRecord.date).toLocaleDateString()}`;
            document.getElementById('last-record-diagnosis').textContent = lastRecord.diagnosis;
        } else {
            document.getElementById('last-record-date').textContent = 'Date: --';
            document.getElementById('last-record-diagnosis').textContent = 'No previous records found.';
        }

        // Links
        document.getElementById('call-link').href = `tel:${patient.phone}`;
        document.getElementById('whatsapp-link').href = `https://wa.me/${patient.phone?.replace(/\s/g, '')}`;

        modal.style.display = 'block';
    }

    // Modal Events
    if (closeModal) {
        closeModal.onclick = () => modal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };

    // Search Event
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentPage = 1;
            displayPatients();
        });
    }

    loadData();
});