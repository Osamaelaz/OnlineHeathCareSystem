window.addEventListener('load', async () => {
    const searchInput = document.querySelector('.search-box input');
    const specFilter = document.querySelector('.spec-select');
    const tableBody = document.getElementById('applicationsTableBody');
    const countBadge = document.querySelector('.count-badge');
    const selectAllCheck = document.getElementById('selectAll');

    const modalOverlay = document.getElementById('modalOverlay');
    const addDocModal = document.getElementById('addDoctorModal');
    const confirmModal = document.getElementById('confirmModal');
    const btnOpenAddManual = document.querySelector('.btn-add-manual');
    const addDocForm = document.getElementById('addDoctorForm');
    const docImgInput = document.getElementById('docImg');
    const imgPreview = document.getElementById('imgPreview');

    const bulkApproveBtn = document.querySelector('.btn-bulk-approve');
    const bulkRejectBtn = document.querySelector('.btn-bulk-reject');
    const selectedCountText = document.querySelector('.side-card-text');

    let currentProfilePath = '/images/doctor-profile.png';
    let allApplications = [];

    async function loadApplications() {
        try {
            allApplications = await HealthcareStorage.doctorApplications.getAll();
            allApplications = allApplications.filter(app => app.status === 'pending');
            renderApplications();
        } catch (error) {
            console.error('Failed to load applications:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="no-results">Failed to load applications</td></tr>`;
        }
    }

    function renderApplications() {
        const q = (searchInput?.value || '').toLowerCase();
        const spec = specFilter?.value || 'all';

        const filtered = allApplications.filter(app => {
            const matchesSearch = (app.fullname || '').toLowerCase().includes(q) || 
                                  (app.email || '').toLowerCase().includes(q);
            const matchesSpec = spec === 'all' || app.specialty === spec;
            return matchesSearch && matchesSpec;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="no-results">No pending applications found.</td></tr>`;
            countBadge.textContent = '0';
            return;
        }

        tableBody.innerHTML = filtered.map(app => {
            const profileImg = app.profileImg || '/images/doctor-profile.png';
            const dob = app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString('en-GB') : 'Not provided';
            const experience = app.experience ? (app.experience === '15+' ? 'Over 15 Years' : app.experience + ' years') : 'Not provided';
            const price = app.appointmentPrice ? `${app.appointmentPrice} EGP` : 'Not set';

            const detailsContent = `
                <div style="display:flex; align-items:flex-start; gap:32px; flex-wrap:wrap; padding:32px; background:var(--bg-body);">
                    <img src="${profileImg}" alt="${app.fullname}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:4px solid var(--primary);">
                    <div style="flex:1; min-width:300px; line-height:2;">
                        <h4 style="margin:0 0 20px 0; font-size:26px; color:var(--text-main);">${app.fullname || 'N/A'}</h4>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                            <p><strong>Email:</strong> ${app.email}</p>
                            <p><strong>Phone:</strong> ${app.phone || 'Not provided'}</p>
                            <p><strong>Date of Birth:</strong> ${dob}</p>
                            <p><strong>Specialty:</strong> ${app.specialty || 'Not specified'}</p>
                            <p><strong>Experience:</strong> ${experience}</p>
                            <p><strong>Appointment Price:</strong> ${price}</p>
                        </div>
                    </div>
                </div>
            `;

            return `
                <tr class="app-row" data-id="${app.id}">
                    <td><input type="checkbox" class="row-check"></td>
                    <td>
                        <div class="applicant-cell">
                            <img src="${profileImg}" alt="${app.fullname}" class="avatar-mini">
                            <span>${app.fullname}</span>
                        </div>
                    </td>
                    <td>${app.specialty || 'N/A'}</td>
                    <td>${new Date(app.createdAt).toLocaleDateString('en-GB')}</td>
                    <td class="action-buttons">
                        <button class="btn btn-outline view-details-btn">View</button>
                        <button class="btn-approve" data-action="approve">
                            <i class="fa-solid fa-check"></i> Approve
                        </button>
                        <button class="btn-reject" data-action="reject">
                            <i class="fa-solid fa-xmark"></i> Reject
                        </button>
                    </td>
                </tr>
                <tr class="details-row" style="display:none;">
                    <td colspan="5" style="padding:0;">
                        ${detailsContent}
                    </td>
                </tr>
            `;
        }).join('');

        countBadge.textContent = filtered.length;
        updateBulkButtons();
    }

    // Approve / Reject
    tableBody.addEventListener('click', async (e) => {
        const approveBtn = e.target.closest('.btn-approve');
        const rejectBtn = e.target.closest('.btn-reject');

        if (approveBtn || rejectBtn) {
            const row = (approveBtn || rejectBtn).closest('.app-row');
            const appId = row.dataset.id;
            const app = allApplications.find(a => a.id === appId);
            if (!app) return;

            const action = approveBtn ? 'approved' : 'rejected';
            const actionText = action === 'approved' ? 'Approve' : 'Reject';

            const confirmed = await customConfirm(`${actionText} Application`, 
                `Are you sure you want to ${actionText.toLowerCase()} Dr. ${app.fullname}?`);

            if (confirmed) {
                try {
                    await HealthcareStorage.doctorApplications.updateStatus(appId, action);
                    showToast(`Dr. ${app.fullname} has been ${action}!`, action === 'approved' ? 'success' : 'error');
                    await loadApplications();
                } catch (err) {
                    showToast('Operation failed!', 'error');
                }
            }
        }
    });

    // View Details
    tableBody.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-details-btn');
        if (!viewBtn) return;

        const row = viewBtn.closest('.app-row');
        const detailsRow = row.nextElementSibling;

        if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
            detailsRow.style.display = 'table-row';
            viewBtn.textContent = 'Hide';
            viewBtn.style.background = 'var(--primary)';
            viewBtn.style.color = 'white';
        } else {
            detailsRow.style.display = 'none';
            viewBtn.textContent = 'View';
            viewBtn.style.background = 'transparent';
            viewBtn.style.color = 'var(--primary)';
        }
    });

    // Add Doctor Manually
    btnOpenAddManual.addEventListener('click', () => {
        addDocForm.reset();
        imgPreview.src = '/images/doctor-profile.png';
        currentProfilePath = '/images/doctor-profile.png';
        showModal(addDocModal);
    });

    docImgInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const persistentData = await HealthcareStorage.utils.processImage(file);
                imgPreview.src = persistentData;
                currentProfilePath = persistentData;
            } catch (err) {
                console.error('Image processing failed:', err);
            }
        }
    });

    addDocForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullname = document.getElementById('docName').value.trim();
        const email = document.getElementById('docEmail').value.trim();
        const phone = document.getElementById('docPhone').value.trim();
        const password = document.getElementById('docPass').value;
        const confirmPassword = document.getElementById('docConfirmPass').value;
        const dateOfBirth = document.getElementById('docDob').value;
        const specialty = document.getElementById('docSpec').value;
        const experience = document.getElementById('docExperience').value;
        const appointmentPrice = document.getElementById('docPrice').value.trim();

        // Validation
        if (!/^[a-zA-Z\s\u0600-\u06FF]{2,50}$/.test(fullname)) {
            showToast('Full name must be 2-50 letters only', 'error');
            return;
        }
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
            showToast('Invalid email format', 'error');
            return;
        }
        if (!/^01[0125][0-9]{8}$/.test(phone)) {
            showToast('Invalid Egyptian phone number', 'error');
            return;
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)) {
            showToast('Weak password', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (!dateOfBirth) {
            showToast('Date of birth required', 'error');
            return;
        }
        if (!specialty || !experience || !appointmentPrice || isNaN(appointmentPrice) || appointmentPrice <= 0) {
            showToast('Please fill all professional fields', 'error');
            return;
        }

        const newDoctor = {
            fullname,
            email,
            phone,
            password,
            role: 'doctor',
            profileImg: currentProfilePath,
            dateOfBirth,
            specialty,
            experience: experience === '15+' ? '15+' : experience,
            appointmentPrice: parseFloat(appointmentPrice),
            status: 'active'
        };

        try {
            await HealthcareStorage.users.create(newDoctor);
            showToast(`Dr. ${fullname} added successfully!`, 'success');
            hideModals();
        } catch (err) {
            showToast('Failed to add doctor: ' + err.message, 'error');
        }
    });

    // Search & Filter
    searchInput.addEventListener('input', renderApplications);
    specFilter.addEventListener('change', renderApplications);

    // Bulk Actions
    function updateBulkButtons() {
        const checkedCount = tableBody.querySelectorAll('.row-check:checked').length;
        if (checkedCount > 0) {
            bulkApproveBtn.disabled = false;
            bulkRejectBtn.disabled = false;
            selectedCountText.textContent = `${checkedCount} selected`;
        } else {
            bulkApproveBtn.disabled = true;
            bulkRejectBtn.disabled = true;
            selectedCountText.textContent = '0 applications selected';
        }
    }

    // Modal Controls
    function showModal(modal) {
        modalOverlay.style.display = 'block';
        modal.style.display = 'block';
        setTimeout(() => {
            modalOverlay.classList.add('active');
            modal.classList.add('active');
        }, 10);
    }

    function hideModals() {
        modalOverlay.classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        setTimeout(() => {
            modalOverlay.style.display = 'none';
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }, 300);
    }

    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', hideModals));
    modalOverlay.addEventListener('click', hideModals);

    // Custom Confirm
    let confirmResolve = null;
    function customConfirm(title, message) {
        return new Promise(resolve => {
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            showModal(confirmModal);
            confirmResolve = resolve;
        });
    }

    document.getElementById('confirmAction').addEventListener('click', () => confirmResolve?.(true));
    document.getElementById('cancelAction').addEventListener('click', () => confirmResolve?.(false));

    // Toast
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.querySelector('.toast-message').textContent = message;
            toast.className = `toast ${type} show`;
            setTimeout(() => toast.classList.remove('show'), 4000);
        }
    }

    // Initial Load
    await loadApplications();
});