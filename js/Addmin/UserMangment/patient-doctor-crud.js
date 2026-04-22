// --- ELEMENTS ---
const tableBody = document.getElementById('tableBody');
const crudModal = document.getElementById('crudModal');
const modalTitle = document.getElementById('modalTitle');
const crudForm = document.getElementById('crudForm');
const addNewBtn = document.getElementById('addNewBtn');
const closeModalBtn = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const profileImgInput = document.getElementById('profileImg');
const imgPreview = document.getElementById('imgPreview');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationInfo = document.getElementById('paginationInfo');

// --- STATE ---
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const usersPerPage = 10;
let editingUserId = null;
let profileImgPath = '/images/patient-profile.png';

// --- PATTERNS ---
const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    phone: /^01[0125][0-9]{8}$/,
    name: /^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]{2,50}$/
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupRoleToggle();
    setupDateOfBirth();
    loadUsers();
});

// --- EVENT LISTENERS ---
function setupEventListeners() {
    addNewBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    crudModal.addEventListener('click', (e) => {
        if (e.target === crudModal) closeModal();
    });
    crudForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', () => filterAndRender());
    roleFilter.addEventListener('change', () => filterAndRender());
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) renderUsers(currentPage - 1);
    });
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
        if (currentPage < totalPages) renderUsers(currentPage + 1);
    });

    // Profile image upload
    profileImgInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                profileImgPath = await HealthcareStorage.utils.processImage(file);
                imgPreview.src = profileImgPath;
                if (window.showToast) window.showToast('Image uploaded successfully!', 'success');
            } catch (err) {
                console.error('Image processing failed:', err);
                if (window.showToast) window.showToast('Failed to process image', 'error');
            }
        }
    });

    // Password toggle
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-password')) {
            const input = e.target.previousElementSibling;
            if (input && input.type === 'password') {
                input.type = 'text';
                e.target.classList.remove('fa-eye');
                e.target.classList.add('fa-eye-slash');
            } else if (input && input.type === 'text') {
                input.type = 'password';
                e.target.classList.remove('fa-eye-slash');
                e.target.classList.add('fa-eye');
            }
        }
    });

    // Table actions
    tableBody.addEventListener('click', handleTableAction);
}

function setupRoleToggle() {
    const roleInputs = document.querySelectorAll('input[name="userRole"]');
    roleInputs.forEach(input => {
        input.addEventListener('change', toggleRoleFields);
    });
}

function setupDateOfBirth() {
    const dobField = document.getElementById('dob');
    if (dobField) {
        const today = new Date().toISOString().split('T')[0];
        dobField.max = today;
    }
}

// --- ROLE TOGGLE ---
function toggleRoleFields() {
    const selectedRole = document.querySelector('input[name="userRole"]:checked').value;
    const patientFields = document.getElementById('patientFields');
    const doctorFields = document.getElementById('doctorFields');
    const passwordField = document.getElementById('password');
    const passwordHint = document.getElementById('passwordHint');

    if (selectedRole === 'patient') {
        patientFields.style.display = 'block';
        doctorFields.style.display = 'none';
        doctorFields.querySelectorAll('input, select').forEach(f => {
            f.disabled = true;
            f.removeAttribute('required');
        });
        patientFields.querySelectorAll('input, select').forEach(f => {
            f.disabled = false;
        });
        if (!profileImgInput.files.length) {
            profileImgPath = '/images/patient-profile.png';
            imgPreview.src = profileImgPath;
        }
    } else {
        patientFields.style.display = 'none';
        doctorFields.style.display = 'block';
        patientFields.querySelectorAll('input, select').forEach(f => {
            f.disabled = true;
        });
        doctorFields.querySelectorAll('input, select').forEach(f => {
            f.disabled = false;
            if (f.id === 'specialty' || f.id === 'experience' || f.id === 'appointmentPrice') {
                f.setAttribute('required', 'required');
            }
        });
        if (!profileImgInput.files.length) {
            profileImgPath = '/images/doctor-profile.png';
            imgPreview.src = profileImgPath;
        }
    }
}

// --- MODAL MANAGEMENT ---
function openAddModal() {
    editingUserId = null;
    modalTitle.textContent = 'Add New User';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-save"></i> Create User';
    crudForm.reset();
    profileImgPath = '/images/patient-profile.png';
    imgPreview.src = profileImgPath;
    document.getElementById('rolePatient').checked = true;
    toggleRoleFields();
    document.getElementById('password').required = true;
    document.getElementById('password').placeholder = 'Enter password';
    crudModal.classList.add('active');
}

function openEditModal(user) {
    editingUserId = user.id;
    modalTitle.textContent = 'Edit User';
    document.getElementById('submitBtn').innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
    
    // Fill form with user data
    document.getElementById('fullname').value = user.fullname || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('dob').value = user.dateOfBirth || '';
    
    // Set role
    if (user.role === 'patient') {
        document.getElementById('rolePatient').checked = true;
    } else {
        document.getElementById('roleDoctor').checked = true;
    }
    toggleRoleFields();
    
    // Doctor specific fields
    if (user.role === 'doctor') {
        document.getElementById('specialty').value = user.specialty || '';
        document.getElementById('experience').value = user.experience || '';
        document.getElementById('appointmentPrice').value = user.appointmentPrice || '';
    }
    
    // Profile image
    profileImgPath = user.profileImg || (user.role === 'doctor' ? '/images/doctor-profile.png' : '/images/patient-profile.png');
    imgPreview.src = profileImgPath;
    
    // Password field (optional for edit)
    const passwordField = document.getElementById('password');
    passwordField.required = false;
    passwordField.placeholder = 'Leave blank to keep current password';
    passwordField.value = '';
    
    crudModal.classList.add('active');
}

function closeModal() {
    crudModal.classList.remove('active');
    crudForm.reset();
    editingUserId = null;
    profileImgPath = '/images/patient-profile.png';
    imgPreview.src = profileImgPath;
}

// --- DATA LOADING ---
async function loadUsers() {
    try {
        tableBody.innerHTML = `
            <tr class="loading-state">
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-right: 10px;"></i>
                    Loading users...
                </td>
            </tr>
        `;
        
        const users = await HealthcareStorage.admin.users.getAll();
        allUsers = users.filter(u => u.role === 'patient' || u.role === 'doctor');
        filterAndRender();
    } catch (error) {
        console.error('Failed to load users:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fa-solid fa-exclamation-triangle" style="margin-right: 10px;"></i>
                    Failed to load users. Please try again.
                </td>
            </tr>
        `;
    }
}

function filterAndRender() {
    const query = (searchInput.value || '').toLowerCase();
    const role = roleFilter.value;

    filteredUsers = allUsers.filter(user => {
        const matchesSearch = (user.fullname || '').toLowerCase().includes(query) ||
                            (user.email || '').toLowerCase().includes(query) ||
                            (user.phone || '').includes(query);
        const matchesRole = !role || user.role === role;
        return matchesSearch && matchesRole;
    });

    renderUsers(1);
}

function renderUsers(page = 1) {
    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / usersPerPage);
    currentPage = Math.max(1, Math.min(page, totalPages || 1));

    const start = (currentPage - 1) * usersPerPage;
    const end = start + usersPerPage;
    const pageUsers = filteredUsers.slice(start, end);

    if (pageUsers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 60px; color: var(--text-muted);">
                    <i class="fa-solid fa-inbox" style="font-size: 48px; opacity: 0.5; margin-bottom: 16px; display: block;"></i>
                    No users found
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = pageUsers.map(user => {
            const profileImg = user.profileImg ||
                (user.role === 'doctor' ? '/images/doctor-profile.png' : '/images/patient-profile.png');
           
            const roleText = user.role.charAt(0).toUpperCase() + user.role.slice(1);

            return `
                <tr>
                    <td>
                        <img src="${profileImg}" alt="${user.fullname}" class="table-avatar">
                    </td>
                    <td>${user.fullname || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td><span class="badge badge-${user.role}">${roleText}</span></td>
                    <td class="actions">
                        <button class="btn-edit" data-id="${user.id}" title="Edit">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="btn-delete" data-id="${user.id}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update pagination
    const from = totalUsers === 0 ? 0 : (currentPage - 1) * usersPerPage + 1;
    const to = Math.min(currentPage * usersPerPage, totalUsers);
    paginationInfo.textContent = `Showing ${from} to ${to} of ${totalUsers} entries`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalUsers === 0;
}

// --- TABLE ACTIONS ---
async function handleTableAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const userId = btn.dataset.id;
    if (!userId) return;

    if (btn.classList.contains('btn-edit')) {
        try {
            const user = await HealthcareStorage.users.getById(userId);
            if (user) {
                openEditModal(user);
            } else {
                if (window.showToast) window.showToast('User not found', 'error');
            }
        } catch (err) {
            console.error('Failed to load user:', err);
            if (window.showToast) window.showToast('Failed to load user data', 'error');
        }
    } else if (btn.classList.contains('btn-delete')) {
        if (confirm(`Are you sure you want to delete ${btn.closest('tr').querySelector('td:nth-child(2)').textContent}?`)) {
            try {
                await HealthcareStorage.admin.users.delete(userId);
                if (window.showToast) window.showToast('User deleted successfully!', 'success');
                loadUsers();
            } catch (err) {
                console.error('Failed to delete user:', err);
                if (window.showToast) window.showToast('Failed to delete user', 'error');
            }
        }
    }
}

// --- FORM VALIDATION ---
function validateForm() {
    let isValid = true;
    const fullname = document.getElementById('fullname');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const password = document.getElementById('password');
    const dob = document.getElementById('dob');
    const selectedRole = document.querySelector('input[name="userRole"]:checked').value;

    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    // Validate fullname
    if (!fullname.value.trim()) {
        showFieldError(fullname, 'Full name is required');
        isValid = false;
    } else if (!patterns.name.test(fullname.value.trim())) {
        showFieldError(fullname, 'Invalid name format');
        isValid = false;
    }

    // Validate email
    if (!email.value.trim()) {
        showFieldError(email, 'Email is required');
        isValid = false;
    } else if (!patterns.email.test(email.value.trim())) {
        showFieldError(email, 'Invalid email format');
        isValid = false;
    }

    // Validate phone
    if (!phone.value.trim()) {
        showFieldError(phone, 'Phone is required');
        isValid = false;
    } else if (!patterns.phone.test(phone.value.trim())) {
        showFieldError(phone, 'Invalid phone format (e.g., 01228139573)');
        isValid = false;
    }

    // Validate password (required for new users, optional for edit)
    if (!editingUserId) {
        if (!password.value.trim()) {
            showFieldError(password, 'Password is required');
            isValid = false;
        } else if (!patterns.password.test(password.value.trim())) {
            showFieldError(password, 'Weak password. Use 8+ chars, uppercase, lowercase, number, special char');
            isValid = false;
        }
    } else if (password.value.trim() && !patterns.password.test(password.value.trim())) {
        showFieldError(password, 'Weak password. Use 8+ chars, uppercase, lowercase, number, special char');
        isValid = false;
    }

    // Validate date of birth
    if (!dob.value) {
        showFieldError(dob, 'Date of birth is required');
        isValid = false;
    } else {
        const selectedDate = new Date(dob.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) {
            showFieldError(dob, 'Date of birth cannot be in the future');
            isValid = false;
        }
    }

    // Validate doctor fields
    if (selectedRole === 'doctor') {
        const specialty = document.getElementById('specialty');
        const experience = document.getElementById('experience');
        const appointmentPrice = document.getElementById('appointmentPrice');

        if (!specialty.value) {
            showFieldError(specialty, 'Specialty is required');
            isValid = false;
        }
        if (!experience.value) {
            showFieldError(experience, 'Experience is required');
            isValid = false;
        }
        if (!appointmentPrice.value || parseFloat(appointmentPrice.value) < 0) {
            showFieldError(appointmentPrice, 'Valid appointment price is required');
            isValid = false;
        }
    }

    return isValid;
}

function showFieldError(input, message) {
    input.classList.add('input-error');
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    input.closest('.form-group').appendChild(error);
}

// --- FORM SUBMISSION ---
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm()) {
        if (window.showToast) window.showToast('Please fix the errors in the form', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const selectedRole = document.querySelector('input[name="userRole"]:checked').value;
        const userData = {
            fullname: document.getElementById('fullname').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            dateOfBirth: document.getElementById('dob').value,
            role: selectedRole,
            profileImg: profileImgPath,
        };

        // Add password if provided
        const password = document.getElementById('password').value.trim();
        if (password) {
            userData.password = password;
        }

        // Add doctor-specific fields
        if (selectedRole === 'doctor') {
            userData.specialty = document.getElementById('specialty').value;
            userData.experience = document.getElementById('experience').value;
            userData.appointmentPrice = parseFloat(document.getElementById('appointmentPrice').value);
            userData.salary = 0; // Initialize salary
        }

        if (editingUserId) {
            // Update existing user
            // Check if email is being changed and if it's already taken
            const currentUser = await HealthcareStorage.users.getById(editingUserId);
            if (currentUser.email !== userData.email) {
                const existingUser = await HealthcareStorage.auth.getUserByEmail(userData.email);
                if (existingUser && existingUser.id !== editingUserId) {
                    throw new Error('Email already exists');
                }
            }

            await HealthcareStorage.auth.updateUser(editingUserId, userData);
            if (window.showToast) window.showToast('User updated successfully!', 'success');
        } else {
            // Create new user
            // Check if email already exists
            const existingUser = await HealthcareStorage.auth.getUserByEmail(userData.email);
            if (existingUser) {
                throw new Error('Email already exists');
            }

            if (!password) {
                throw new Error('Password is required for new users');
            }

            await HealthcareStorage.admin.users.create(userData);
            if (window.showToast) window.showToast('User created successfully!', 'success');
        }

        closeModal();
        loadUsers();
    } catch (error) {
        console.error('Form submission error:', error);
        if (window.showToast) window.showToast(error.message || 'Operation failed', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

