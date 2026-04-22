window.addEventListener('load', async () => {
    // 1. Auth Guard
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') {
        window.location.href = '../../html/Auth/login.html';
        return;
    }

    const recordsList = document.getElementById('recordsList');

    function generatePrescriptionPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('Prescription', 105, 20, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(80, 80, 180);
        doc.text(data.medication, 20, 40);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${data.date}`, 20, 50);

        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 60, 190, 60);

        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Prescribed by:', 20, 75);
        doc.setFontSize(16);
        doc.setTextColor(80, 80, 180);
        doc.text(data.doctor, 20, 85);

        doc.setFontSize(14);
        doc.text('Dosage:', 20, 105);
        doc.setFontSize(13);
        doc.text(data.dosage, 20, 115);

        doc.setFontSize(14);
        doc.text('Frequency:', 20, 130);
        doc.setFontSize(13);
        doc.text(data.frequency, 20, 140);

        doc.setFontSize(14);
        doc.text('Instructions:', 20, 155);
        doc.setFontSize(13);
        const splitInstructions = doc.splitTextToSize(data.instructions || 'No instructions available.', 170);
        doc.text(splitInstructions, 20, 165);

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Generated from Online Health System', 105, 280, { align: 'center' });

        doc.save(`${data.medication.replace(/[^a-z0-9]/gi, '_')}_Prescription_${data.date.replace(/[^a-z0-9]/gi, '-')}.pdf`);
    }

    // 2. Load Prescriptions
    async function loadRecords() {
        try {
            recordsList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Fetching your prescriptions...</p></div>';

            const allRecords = await HealthcareStorage.prescriptions.getByPatient(currentUser.id);

            const appointments = await HealthcareStorage.appointments.getByPatient(currentUser.id);

            const completedAppointmentIds = new Set(
                appointments
                    .filter(app => app.status === 'completed')
                    .map(app => app.id)
            );

            const visibleRecords = allRecords.filter(record => 
                record.appointmentId && completedAppointmentIds.has(record.appointmentId)
            );

            if (visibleRecords.length === 0) {
                recordsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-pills" style="font-size: 60px; color: #ddd; margin-bottom: 20px;"></i>
                        <h3>No Prescriptions Available Yet</h3>
                        <p>Prescriptions will appear here once your doctor completes the appointment and issues them.</p>
                    </div>
                `;
                return;
            }

            const doctorIds = [...new Set(visibleRecords.map(r => r.doctorId))];
            const doctorsData = await Promise.all(doctorIds.map(id => HealthcareStorage.users.getById(id)));
            const doctorsMap = Object.fromEntries(doctorsData.filter(d => d).map(d => [d.id, d]));

            recordsList.innerHTML = visibleRecords.map(record => {
                const doc = doctorsMap[record.doctorId] || { fullname: 'Healthcare System' };
                const date = new Date(record.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                return `
                    <div class="record-card">
                        <div class="record-header">
                            <div class="record-type">
                                <div class="type-icon">
                                    <i class="fa-solid fa-pills"></i>
                                </div>
                                <div class="type-info">
                                    <h3>${record.medication}</h3>
                                    <p>Prescription</p>
                                </div>
                            </div>
                            <span class="record-date">${date}</span>
                        </div>
                        <div class="record-body">
                            <p class="record-summary">${record.instructions || 'No instructions provided.'}</p>
                            <div class="record-meta">
                                <div class="meta-item">
                                    <span>Prescribed By</span>
                                    <p>Dr. ${doc.fullname}</p>
                                </div>
                                <div class="meta-item">
                                    <span>Dosage</span>
                                    <p>${record.dosage || 'Not specified'}</p>
                                </div>
                                <div class="meta-item">
                                    <span>Frequency</span>
                                    <p>${record.frequency || 'Not specified'}</p>
                                </div>
                            </div>
                        </div>
                        <div class="record-footer">
                            <button class="action-btn view-btn" onclick="viewRecordDetails('${record.id}')">
                                <i class="fa-solid fa-eye"></i> View
                            </button>
                            <button class="action-btn download-btn">
                                <i class="fa-solid fa-download"></i> Download
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // وظيفة التحميل لكل كارد
            document.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const card = this.closest('.record-card');
                    const medication = card.querySelector('.type-info h3').textContent.trim();
                    const date = card.querySelector('.record-date').textContent.trim();
                    const doctor = card.querySelector('.record-meta .meta-item:nth-child(1) p').textContent.trim();
                    const dosage = card.querySelector('.record-meta .meta-item:nth-child(2) p').textContent.trim();
                    const frequency = card.querySelector('.record-meta .meta-item:nth-child(3) p').textContent.trim();
                    const instructions = card.querySelector('.record-summary').textContent.trim();

                    generatePrescriptionPDF({ medication, date, doctor, dosage, frequency, instructions });
                });
            });

        } catch (error) {
            console.error('Error loading prescriptions:', error);
            recordsList.innerHTML = '<p class="error">Failed to load prescriptions. Please try again later.</p>';
        }
    }

window.viewRecordDetails = async (recordId) => {
    const modal = document.getElementById('recordModal');
    const detailBody = document.getElementById('recordDetailBody');

    try {
        const record = await HealthcareStorage.prescriptions.getById(recordId);
        if (!record) {
            showToast('Prescription not found.', 'error');
            return;
        }

        const doctor = await HealthcareStorage.users.getById(record.doctorId);
        if (!doctor) {
            showToast('Doctor information not available.', 'error');
            return;
        }

        document.querySelector('.modal-header h2').textContent = record.medication;

        detailBody.innerHTML = `
            <div class="detail-section">
                <h4>Instructions</h4>
                <p>${record.instructions || 'No instructions available.'}</p>
            </div>
            <div class="detail-grid">
                <div class="detail-item">
                    <strong>Doctor:</strong>
                    <span>Dr. ${doctor.fullname}</span>
                </div>
                <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-item">
                    <strong>Medication:</strong>
                    <span>${record.medication}</span>
                </div>
                <div class="detail-item">
                    <strong>Dosage:</strong>
                    <span>${record.dosage || 'Not specified'}</span>
                </div>
                <div class="detail-item">
                    <strong>Frequency:</strong>
                    <span>${record.frequency || 'Not specified'}</span>
                </div>
            </div>
        `;

        document.getElementById('downloadRecord').onclick = () => {
            generatePrescriptionPDF({
                medication: record.medication,
                date: new Date(record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                doctor: `Dr. ${doctor.fullname}`,
                dosage: record.dosage || 'Not specified',
                frequency: record.frequency || 'Not specified',
                instructions: record.instructions || 'No instructions available.'
            });
        };

        modal.style.display = 'block';

    } catch (error) {
        console.error('Error viewing prescription:', error);
        showToast('Could not load prescription details. Please try again.', 'error');
    }
};
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('recordModal').style.display = 'none';
        };
    });

    window.onclick = (event) => {
        const modal = document.getElementById('recordModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    await loadRecords();
});