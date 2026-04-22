// --- ELEMENTS ---
const tableBody = document.querySelector('.users-table tbody');
const addUserModal = document.getElementById('addUserModal');
const modalTitle = document.querySelector('.modal-header h2');
const modalSubmitBtn = document.querySelector('.modal-footer .btn-primary');
const btnAddNew = document.querySelector('.btn-add-new');
const addUserForm = document.getElementById('addUserForm');
const closeModalBtns = document.querySelectorAll('.close-modal');
const searchInput = document.querySelector('.search-box');
const roleFilter = document.querySelector('.filter-role');
const newUserImgInput = document.getElementById('newUserImg');
const newUserPreview = document.getElementById('newUserPreview');

const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationInfo = document.getElementById('paginationInfo');

let newUserProfilePath = '/images/patient-profile.png';
let allFilteredUsers = [];
let currentPage = 1;
const usersPerPage = 6;
let editingUserId = null; 

if (newUserImgInput) {
    newUserImgInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const persistentData = await HealthcareStorage.utils.processImage(file);
                newUserPreview.src = persistentData;
                newUserProfilePath = persistentData;
            } catch (err) {
                console.error('Image processing failed:', err);
            }
        }
    });
}

if (btnAddNew) {
    btnAddNew.addEventListener('click', () => {
        editingUserId = null;
        modalTitle.textContent = 'Add New User';
        modalSubmitBtn.textContent = 'Add User';
        addUserForm.reset();
        newUserPreview.src = '/images/patient-profile.png';
        newUserProfilePath = '/images/patient-profile.png';
        document.getElementById('newPassword').required = true;
        document.getElementById('newPassword').placeholder = 'Enter password';
        addUserModal.classList.add('active');
    });
}

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        addUserModal.classList.remove('active');
    });
});

async function renderUsers(page = 1) {
    try {
        const users = await HealthcareStorage.admin.users.getAll();

        const query = (searchInput?.value || '').toLowerCase();
        const role = roleFilter?.value;

        allFilteredUsers = users.filter(u => {
            const matchesSearch = (u.fullname || '').toLowerCase().includes(query) || 
                                  (u.email || '').toLowerCase().includes(query);
            const matchesRole = !role || u.role === role;
            return matchesSearch && matchesRole;
        });

        const totalUsers = allFilteredUsers.length;
        const totalPages = Math.ceil(totalUsers / usersPerPage);
        currentPage = Math.max(1, Math.min(page, totalPages || 1));

        const start = (currentPage - 1) * usersPerPage;
        const end = start + usersPerPage;
        const pageUsers = allFilteredUsers.slice(start, end);

        tableBody.innerHTML = pageUsers.length === 0 ?
            `<tr><td colspan="5" style="text-align:center; padding:60px; color:var(--text-muted);">No users found</td></tr>` :
            pageUsers.map(u => {
                const profileImg = u.profileImg || 
                    (u.role === 'admin' ? '/images/admin-profile.png' : 
                     u.role === 'doctor' ? '/images/doctor-profile.png' : '/images/patient-profile.png');

                const status = u.status || 'active';
                const statusClass = status === 'pending' ? 'badge-pending' : 
                                    status === 'inactive' ? 'badge-inactive' : 'badge-active';
                const statusText = status.charAt(0).toUpperCase() + status.slice(1);

                return `
                    <tr>
                        <td>
                            <div class="user-info">
                                <img src="${profileImg}" alt="${u.fullname}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                <span>${u.fullname || 'N/A'}</span>
                            </div>
                        </td>
                        <td>${u.email}</td>
                        <td><span class="badge badge-${u.role}">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                        <td class="actions">
                            <button class="btn-edit" data-id="${u.id}">Edit</button>
                            <button class="btn-delete" data-id="${u.id}">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');

        const from = totalUsers === 0 ? 0 : (currentPage - 1) * usersPerPage + 1;
        const to = Math.min(currentPage * usersPerPage, totalUsers);
        paginationInfo.textContent = `Showing ${from} to ${to} of ${totalUsers} entries`;

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalUsers === 0;

    } catch (error) {
        console.error('Failed to render users:', error);
        tableBody.innerHTML = `<tr><td colspan="5" style="color:#ef4444; text-align:center;">Error loading users</td></tr>`;
    }
}

// --- EDIT & DELETE BUTTONS ---
tableBody.addEventListener('click', async (e) => {
    const btn = e.target;

    if (btn.classList.contains('btn-edit')) {
        const userId = btn.dataset.id;
        try {
            const user = await HealthcareStorage.users.getById(userId);

            if (!user) {
                alert('User not found');
                return;
            }

            editingUserId = userId;
            modalTitle.textContent = 'Edit User';
            modalSubmitBtn.textContent = 'Save Changes';

            document.getElementById('newFullname').value = user.fullname || '';
            document.getElementById('newEmail').value = user.email;
            document.getElementById('newRole').value = user.role;
            document.getElementById('newPassword').value = '';
            document.getElementById('newPassword').placeholder = 'Leave blank to keep current password';
            document.getElementById('newPassword').required = false;

            const defaultImg = user.role === 'admin' ? '/images/admin-profile.png' : 
                              user.role === 'doctor' ? '/images/doctor-profile.png' : '/images/patient-profile.png';
            newUserPreview.src = user.profileImg || defaultImg;
            newUserProfilePath = user.profileImg || defaultImg;

            addUserModal.classList.add('active');

        } catch (err) {
            console.error('Failed to load user for editing:', err);
            alert('Failed to load user data. Please try again.');
        }
    }

    if (btn.classList.contains('btn-delete')) {
        const userId = btn.dataset.id;
        if (confirm('Are you sure you want to delete this user?')) {
            try {
                await HealthcareStorage.admin.users.delete(userId);
                renderUsers(currentPage);
                if (window.showToast) window.showToast('User deleted successfully!', 'success');
            } catch (err) {
                alert('Failed to delete user');
            }
        }
    }
});

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userData = {
        fullname: document.getElementById('newFullname').value.trim(),
        email: document.getElementById('newEmail').value.trim(),
        role: document.getElementById('newRole').value,
        profileImg: newUserProfilePath
    };

    const password = document.getElementById('newPassword').value.trim();
    if (password) {
        userData.password = password;
    }

    try {
        if (editingUserId) {
            await HealthcareStorage.auth.updateUser(editingUserId, userData);
            if (window.showToast) window.showToast('User updated successfully!', 'success');
        } else {
            if (!password) throw new Error('Password is required for new users');
            userData.password = password;
            await HealthcareStorage.admin.users.create(userData);
            if (window.showToast) window.showToast('User created successfully!', 'success');
        }

        addUserModal.classList.remove('active');
        renderUsers(currentPage);

    } catch (err) {
        alert(err.message || 'Operation failed');
    }
});

if (searchInput) searchInput.addEventListener('input', () => renderUsers(1));
if (roleFilter) roleFilter.addEventListener('change', () => renderUsers(1));

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) renderUsers(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allFilteredUsers.length / usersPerPage);
    if (currentPage < totalPages) renderUsers(currentPage + 1);
});

document.addEventListener('DOMContentLoaded', () => renderUsers(1));