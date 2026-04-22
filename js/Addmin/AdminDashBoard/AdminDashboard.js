document.addEventListener('DOMContentLoaded', async () => {
    const usersTableBody = document.getElementById('usersTableBody');
    const applicationsList = document.getElementById('applicationsList');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    let currentPage = 1;
    const usersPerPage = 6;
    let allUsers = [];

    async function updateStats() {
        try {
            const [users, applications] = await Promise.all([
                HealthcareStorage.admin.users.getAll(),
                HealthcareStorage.doctorApplications.getAll()
            ]);

            const totalUsers = users.length;
            const totalPatients = users.filter(u => u.role === 'patient').length;
            const activeDoctors = users.filter(u =>
                u.role === 'doctor' && (u.status || 'active') === 'active'
            ).length;
            const pendingApps = applications.filter(a => a.status === 'pending').length;

            document.getElementById('totalUsers').textContent = totalUsers;
            document.getElementById('totalPatients').textContent = totalPatients;
            document.getElementById('activeDoctors').textContent = activeDoctors;
            document.getElementById('pendingApps').textContent = pendingApps;

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async function renderUsers(page = 1) {
        try {
            const users = await HealthcareStorage.admin.users.getAll();

            allUsers = users
                .filter(u =>
                    u.role !== 'admin' &&
                    (u.status || 'active') === 'active'
                )
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            const totalPages = Math.ceil(allUsers.length / usersPerPage);
            currentPage = Math.max(1, Math.min(page, totalPages || 1));

            const start = (currentPage - 1) * usersPerPage;
            const end = start + usersPerPage;
            const pageUsers = allUsers.slice(start, end);

            if (allUsers.length === 0) {
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:80px; color:var(--text-muted);">
                            <i class="fa-solid fa-users-slash" style="font-size:48px; opacity:0.5; margin-bottom:16px; display:block;"></i>
                            <p>No active users yet</p>
                        </td>
                    </tr>`;
            } else {
                usersTableBody.innerHTML = pageUsers.map(user => {
                    const profileImg = user.profileImg ||
                        (user.role === 'doctor' ? '../../../images/doctor-profile.png' : '../../../images/patient-profile.png');

                    const roleText = user.role.charAt(0).toUpperCase() + user.role.slice(1);
                    const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'Unknown';

                    let detailsContent = `
                        <div style="display:flex; align-items:flex-start; gap:32px; flex-wrap:wrap; padding:24px;">
                            <img src="${profileImg}" alt="${user.fullname}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:4px solid var(--primary); box-shadow:0 8px 20px rgba(0,0,0,0.15);">
                            <div style="flex:1; min-width:300px; line-height:2;">
                                <h4 style="margin:0 0 20px 0; font-size:26px; color:var(--text-main);">${user.fullname || 'N/A'}</h4>
                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                                    <p><strong>Email:</strong> ${user.email}</p>
                                    <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
                                    <p><strong>Role:</strong> ${roleText}</p>
                                    <p><strong>Joined On:</strong> ${joined}</p>
                    `;

                    if (user.role === 'patient') {
                        detailsContent += `
                            <p><strong>Gender:</strong> ${user.gender || 'Not specified'}</p>
                            <p><strong>Date of Birth:</strong> ${user.dateOfBirth || 'Not specified'}</p>
                            <p><strong>Medical History:</strong> ${user.medicalHistory && user.medicalHistory.length > 0 ? user.medicalHistory.length + ' records' : 'No records'}</p>
                        `;
                    }

                    if (user.role === 'doctor') {
                        const days = user.workingHours?.days?.join(', ') || 'Not specified';
                        const hours = user.workingHours ? `${user.workingHours.start} - ${user.workingHours.end}` : 'Not specified';

                        detailsContent += `
                            <p><strong>Specialty:</strong> ${user.specialty || 'Not specified'}</p>
                            <p><strong>Experience:</strong> ${user.experience ? user.experience + ' years' : 'Not specified'}</p>
                            <p><strong>Appointment Price:</strong> ${user.appointmentPrice ? user.appointmentPrice + ' EGP' : 'Not set'}</p>
                            <p><strong>Clinic:</strong> ${user.clinic || 'Not specified'}</p>
                            <p><strong>Working Days:</strong> ${days}</p>
                            <p><strong>Working Hours:</strong> ${hours}</p>
                        `;
                    }

                    detailsContent += `
                                </div>
                            </div>
                        </div>
                    `;

                    return `
                        <tr class="user-row">
                            <td>
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <img src="${profileImg}" alt="${user.fullname}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                    <span>${user.fullname || 'N/A'}</span>
                                </div>
                            </td>
                            <td>${user.email}</td>
                            <td><span class="badge badge-${user.role}">${roleText}</span></td>
                            <td><span class="badge badge-active">Active</span></td>
                            <td><a href="#" class="action-link toggle-details">View Details</a></td>
                        </tr>
                        <tr class="details-row" style="display:none;">
                            <td colspan="5" style="background:var(--bg-body); border-top:3px solid var(--primary); padding:0;">
                                ${detailsContent}
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;

        } catch (error) {
            console.error('Error loading users:', error);
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; color:#ef4444; padding:40px;">
                        Failed to load users
                    </td>
                </tr>`;
        }
    }

    async function renderPendingApplications() {
        try {
            const apps = await HealthcareStorage.doctorApplications.getAll();
            const pending = apps.filter(a => a.status === 'pending');

            if (pending.length === 0) {
                applicationsList.innerHTML = `
                    <div style="text-align:center; padding:80px; color:var(--text-muted);">
                        <i class="fa-solid fa-check-circle" style="font-size:60px; color:#10b981; opacity:0.7; margin-bottom:20px;"></i>
                        <p>No pending applications</p>
                    </div>`;
                return;
            }

            applicationsList.innerHTML = pending.slice(0, 3).map(app => {
                const profileImg = app.profileImg || '../../../images/doctor-profile.png';
                const dob = app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString('en-GB') : 'Not provided';
                const experience = app.experience ? app.experience + ' years' : 'Not provided';
                const price = app.appointmentPrice ? app.appointmentPrice + ' EGP' : 'Not set';

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
                    <div class="application-card" data-id="${app.id}">
                        <div class="doctor-info">
                            <div class="doctor-name">${app.fullname}</div>
                            <div class="doctor-specialty">${app.specialty || 'General Practitioner'}</div>
                        </div>
                        <div class="actions">
                            <button class="btn btn-outline view-app-details">View</button>
                            <button class="btn btn-approve" data-action="approve">Approve</button>
                            <button class="btn btn-reject" data-action="reject">Reject</button>
                        </div>
                    </div>
                    <div class="app-details-row" style="display:none;">
                        ${detailsContent}
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading applications:', error);
            applicationsList.innerHTML = `<div style="text-align:center; color:#ef4444; padding:40px;">Failed to load applications</div>`;
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) renderUsers(currentPage - 1);
    });

    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allUsers.length / usersPerPage);
        if (currentPage < totalPages) renderUsers(currentPage + 1);
    });

    // Approve / Reject Actions
    applicationsList?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const card = btn.closest('.application-card');
        const appId = card.dataset.id;
        const doctorName = card.querySelector('.doctor-name').textContent;
        const action = btn.dataset.action;

        if (!confirm(action === 'approve' ? `Approve Dr. ${doctorName}?` : `Reject Dr. ${doctorName}?`)) return;

        try {
            if (action === 'approve') {
                await HealthcareStorage.doctorApplications.updateStatus(appId, 'approved');
            } else {
                await HealthcareStorage.doctorApplications.updateStatus(appId, 'rejected');
            }

            await Promise.all([
                updateStats(),
                renderUsers(currentPage),
                renderPendingApplications()
            ]);

        } catch (err) {
            console.error('Operation failed:', err);
            showNotification('Operation failed!', 'error');
        }
    });

    // View Details for Doctor Application
    applicationsList?.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-app-details');
        if (!viewBtn) return;

        const card = viewBtn.closest('.application-card');
        const detailsRow = card.nextElementSibling;

        if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
            detailsRow.style.display = 'block';
            viewBtn.textContent = 'Hide';
        } else {
            detailsRow.style.display = 'none';
            viewBtn.textContent = 'View';
        }
    });

    // Toggle Details Row in Recent Users
    usersTableBody.addEventListener('click', (e) => {
        const link = e.target.closest('.toggle-details');
        if (!link) return;
        e.preventDefault();

        const row = link.closest('.user-row');
        const detailsRow = row.nextElementSibling;

        if (detailsRow.style.display === 'none' || !detailsRow.style.display) {
            detailsRow.style.display = 'table-row';
            link.textContent = 'Hide Details';
        } else {
            detailsRow.style.display = 'none';
            link.textContent = 'View Details';
        }
    });

    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            padding: 14px 28px; border-radius: 8px; color: white; font-weight: 500;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); min-width: 300px; text-align: center;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function updateAdminInfo() {
        const user = HealthcareStorage.auth.getCurrentUser();
        if (user) {
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) userNameElement.textContent = user.fullname || 'Admin';

            const profileImgElement = document.querySelector('.profile-img');
            if (profileImgElement) profileImgElement.src = user.profileImg || '../../../images/admin-profile.png';
        }
    }

    updateAdminInfo();
    await Promise.all([
        updateStats(),
        renderUsers(1),
        renderPendingApplications()
    ]);
});