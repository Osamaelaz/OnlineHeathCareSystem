// js/Doctor/prescriptions.js

document.addEventListener('DOMContentLoaded', async () => {
    const prescTable = document.getElementById('prescription-history');
    if (!prescTable) return;

    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser) return;

    async function loadPrescriptions() {
        try {
            const prescriptions = await HealthcareStorage.doctor.getPrescriptions(currentUser.id);

            if (prescriptions.length === 0) {
                prescTable.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px;">No prescriptions issued yet.</td></tr>`;
                return;
            }

            // Group prescriptions by appointmentId
            const groupedPrescriptions = prescriptions.reduce((acc, pr) => {
                const key = pr.appointmentId || pr.id;
                if (!acc[key]) {
                    acc[key] = {
                        id: key,
                        patientId: pr.patientId,
                        doctorId: pr.doctorId,
                        appointmentId: pr.appointmentId,
                        date: pr.date,
                        medications: []
                    };
                }
                acc[key].medications.push({
                    medication: pr.medication,
                    dosage: pr.dosage,
                    frequency: pr.frequency,
                    instructions: pr.instructions
                });
                return acc;
            }, {});

            const groupedArray = Object.values(groupedPrescriptions);

            const patientIds = [...new Set(groupedArray.map(p => p.patientId))];
            const patientsData = await Promise.all(patientIds.map(id => HealthcareStorage.users.getById(id)));
            const patientsMap = Object.fromEntries(patientsData.map(p => [p.id, p]));

            prescTable.innerHTML = groupedArray.map(pr => {
                const patient = patientsMap[pr.patientId] || { fullname: 'Unknown Patient' };
                const meds = pr.medications;
                const firstMed = meds[0];
                const otherMedsCount = meds.length - 1;

                return `
                    <tr>
                        <td><span class="date-text">${new Date(pr.date).toLocaleDateString()}</span></td>
                        <td class="patient-name-cell">${patient.fullname}</td>
                        <td>
                            <span class="medication-tag">${firstMed.medication}</span>
                            ${otherMedsCount > 0 ? `<br><small style="color:var(--primary); font-weight:600;">+ ${otherMedsCount} more medicines</small>` : ''}
                        </td>
                        <td>
                            <div style="font-weight: 500;">${firstMed.dosage}</div>
                            <small style="color: var(--text-muted);">${firstMed.frequency}</small>
                        </td>
                        <td>
                            <div class="action-btns">
                                <button class="icon-btn print-btn" title="Print Prescription" onclick="handlePrescription('${pr.id}', 'print')">
                                    <i class="fa-solid fa-print"></i>
                                </button>
                                <button class="icon-btn pdf-btn" title="Download PDF" onclick="handlePrescription('${pr.id}', 'pdf')">
                                    <i class="fa-solid fa-file-pdf"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading prescriptions:', error);
            prescTable.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: #ef4444;">Error loading prescriptions.</td></tr>`;
        }
    }

    loadPrescriptions();

    window.handlePrescription = async (id, action) => {
        try {
            const prescriptions = await HealthcareStorage.doctor.getPrescriptions(currentUser.id);
            const groupPrescriptions = prescriptions.filter(p => (p.appointmentId == id) || (p.id == id));

            if (groupPrescriptions.length === 0) return;

            const pr = groupPrescriptions[0];
            const patient = await HealthcareStorage.users.getById(pr.patientId);
            const doctor = await HealthcareStorage.users.getById(currentUser.id);

            const meds = groupPrescriptions.map(p => ({
                medication: p.medication,
                dosage: p.dosage,
                frequency: p.frequency,
                instructions: p.instructions || ''
            }));

            // Smart Dr. prefix handling
            let docDisplayName = doctor.fullname;
            if (!docDisplayName.toLowerCase().startsWith('dr.')) {
                docDisplayName = `Dr. ${docDisplayName}`;
            }

            const medsHTML = meds.map((m, idx) => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; font-weight: bold; width: 30px; font-size: 12px; vertical-align: top;">${idx + 1}.</td>
                    <td style="padding: 10px;">
                        <div style="font-size: 14px; font-weight: bold; color: #000;">${m.medication}</div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">
                            ${m.dosage} | ${m.frequency}
                            ${m.instructions ? `<div style="margin-top: 5px; padding: 8px; background: #fffcf0; border-left: 3px solid #f59e0b; font-size: 11px;">${m.instructions}</div>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');

            // Simplified Template - Absolutely standard HTML/CSS
            const templateHTML = `
                <div style="width: 790px; background-color: #ffffff; color: #333; font-family: Arial, sans-serif; margin: 0; padding: 40px; border: 1px solid #ddd;">
                    <div style="border-bottom: 3px solid #6A5EFD; padding-bottom: 20px; margin-bottom: 30px;">
                        <h1 style="color: #6A5EFD; margin: 0; font-size: 28px;">Online Health System</h1>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Professional E-Prescription Card</p>
                        
                        <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
                            <div style="font-size: 18px; font-weight: bold;">${docDisplayName}</div>
                            <div style="font-size: 13px; color: #555;">${doctor.specialty} Specialist</div>
                            <div style="font-size: 12px; color: #777; margin-top: 5px;">ID: ${doctor.id.toUpperCase()} | Phone: ${doctor.phone || 'N/A'}</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="width: 50%;">
                                    <div style="font-size: 11px; font-weight: bold; color: #999; text-transform: uppercase;">Patient</div>
                                    <div style="font-size: 16px; font-weight: bold;">${patient.fullname}</div>
                                </td>
                                <td style="text-align: right;">
                                    <div style="font-size: 11px; font-weight: bold; color: #999; text-transform: uppercase;">Date</div>
                                    <div style="font-size: 16px; font-weight: bold;">${new Date(pr.date).toLocaleDateString()}</div>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div style="min-height: 400px; margin-bottom: 40px;">
                        <h3 style="background-color: #6A5EFD; color: white; padding: 8px 15px; font-size: 14px; display: inline-block; margin-bottom: 15px;">Rx MEDICATIONS</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eee;">
                            <thead>
                                <tr style="background-color: #f5f5f5;">
                                    <th style="padding: 10px; border: 1px solid #eee; text-align: left; width: 40px;">#</th>
                                    <th style="padding: 10px; border: 1px solid #eee; text-align: left;">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${medsHTML}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center; border: 2px dashed #eee; width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #ccc;">OFFICIAL STAMP</div>
                        <div style="text-align: right; width: 250px;">
                            <div style="border-bottom: 2px solid #333; margin-bottom: 10px; height: 40px;"></div>
                            <div style="font-size: 15px; font-weight: bold;">${docDisplayName}</div>
                            <div style="font-size: 11px; color: #888;">Authorized Medical Signature</div>
                        </div>
                    </div>

                    <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #aaa;">
                        Generated on ${new Date().toLocaleString()} | Reference: ${pr.id}
                    </div>
                </div>`;

            if (action === 'print') {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`<html><head><title>Print</title></head><body style="margin:0;">${templateHTML}</body></html>`);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            } else if (action === 'pdf') {
                if (typeof html2pdf === 'undefined') {
                    showToast('PDF generator still loading...', 'warning');
                    return;
                }

                showToast('Downloading PDF...', 'info');

                // NEW METHOD: Direct from String. This is the most compatible mode for html2pdf.
                // It handles its own off-screen rendering.
                const opt = {
                    margin: 0,
                    filename: `Prescription_${patient.fullname.replace(/\s+/g, '_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: true
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                // html2pdf can take a string directly. Let's try it.
                html2pdf().from(templateHTML).set(opt).save().then(() => {
                    showToast('Prescription saved!', 'success');
                }).catch(err => {
                    console.error('PDF Catch:', err);
                    showToast('PDF error. Please use Print instead.', 'error');
                });
            }
        } catch (e) {
            console.error('Action Error:', e);
            if (window.showToast) showToast('System process failed.', 'error');
        }
    };
});