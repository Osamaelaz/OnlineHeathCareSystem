document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard
    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') {
        window.location.href = '../../html/Auth/login.html';
        return;
    }

    // Toast Notification
    const showToast = (message, type = 'success') => {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    };

    // Validation Rules
    const validators = {
        fullname: (value) => {
            if (!value || value.trim().length < 3) {
                return 'Full name must be at least 3 characters';
            }
            if (value.trim().length > 50) {
                return 'Full name must not exceed 50 characters';
            }
            if (!/^[a-zA-Z\s]+$/.test(value)) {
                return 'Full name can only contain letters and spaces';
            }
            return null;
        },

        email: (value) => {
            if (!value || !value.trim()) {
                return 'Email is required';
            }
            const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
                return 'Please enter a valid email address';
            }
            return null;
        },

        phone: (value) => {
            if (!value || !value.trim()) {
                return 'Phone number is required';
            }
            const phoneRegex = /^01[0-2,5]{1}[0-9]{8}$/;
            if (!phoneRegex.test(value.replace(/\s/g, ''))) {
                return 'Enter valid Egyptian phone (11 digits starting with 01)';
            }
            return null;
        },

        dateOfBirth: (value) => {
            if (!value) {
                return 'Date of birth is required';
            }
            const birthDate = new Date(value);
            const today = new Date();
            
            if (isNaN(birthDate.getTime())) {
                return 'Please enter a valid date';
            }
            
            const age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
            
            if (birthDate > today) {
                return 'Date of birth cannot be in the future';
            }
            if (adjustedAge > 120) {
                return 'Please enter a valid date of birth';
            }
            if (adjustedAge < 5) {
                return 'Patient must be at least 5 years old';
            }
            return null;
        },

        gender: (value) => {
            if (!value) {
                return 'Please select your gender';
            }
            return null;
        },

        password: (value) => {
            if (!value) {
                return 'Password is required';
            }
            if (value.length < 8) {
                return 'Password must be at least 8 characters';
            }
            if (value.length > 50) {
                return 'Password must not exceed 50 characters';
            }
            if (!/[A-Z]/.test(value)) {
                return 'Must contain at least one uppercase letter';
            }
            if (!/[a-z]/.test(value)) {
                return 'Must contain at least one lowercase letter';
            }
            if (!/[0-9]/.test(value)) {
                return 'Must contain at least one number';
            }
            if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
                return 'Must contain at least one special character';
            }
            return null;
        }
    };

    // Show/Clear Validation
    const showError = (input, message) => {
        const formGroup = input.closest('.form-group');
        let errorDiv = formGroup.querySelector('.error-message');
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> <span></span>';
            formGroup.appendChild(errorDiv);
        }
        
        errorDiv.querySelector('span').textContent = message;
        input.classList.add('error');
        input.classList.remove('success');
    };

    const showSuccess = (input) => {
        const formGroup = input.closest('.form-group');
        const errorDiv = formGroup.querySelector('.error-message');
        if (errorDiv) errorDiv.remove();
        
        input.classList.remove('error');
        input.classList.add('success');
    };

    const clearValidation = (input) => {
        const formGroup = input.closest('.form-group');
        const errorDiv = formGroup.querySelector('.error-message');
        if (errorDiv) errorDiv.remove();
        
        input.classList.remove('error', 'success');
    };

    // Validate Field
    const validateField = (input, validatorName) => {
        const value = input.value.trim();
        const error = validators[validatorName](value);
        
        if (error) {
            showError(input, error);
            return false;
        } else {
            showSuccess(input);
            return true;
        }
    };

    // Password Strength
    const checkPasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
        return strength;
    };

    const updatePasswordStrength = (input) => {
        const password = input.value;
        const formGroup = input.closest('.form-group');
        let strengthDiv = formGroup.querySelector('.password-strength');
        
        if (!strengthDiv && password) {
            strengthDiv = document.createElement('div');
            strengthDiv.className = 'password-strength';
            strengthDiv.innerHTML = '<div class="password-strength-bar"></div>';
            formGroup.appendChild(strengthDiv);
            
            const hint = document.createElement('div');
            hint.className = 'password-hint';
            hint.textContent = 'Use 8+ characters with uppercase, lowercase, numbers & special characters';
            formGroup.appendChild(hint);
        }
        
        if (strengthDiv && password) {
            const bar = strengthDiv.querySelector('.password-strength-bar');
            const strength = checkPasswordStrength(password);
            
            bar.className = 'password-strength-bar';
            if (strength <= 2) bar.classList.add('weak');
            else if (strength <= 4) bar.classList.add('medium');
            else bar.classList.add('strong');
        } else if (strengthDiv && !password) {
            strengthDiv.remove();
            const hint = formGroup.querySelector('.password-hint');
            if (hint) hint.remove();
        }
    };

    // Load Profile Data
    async function loadProfileData() {
        document.getElementById('fullname').value = currentUser.fullname || '';
        document.getElementById('email').value = currentUser.email || '';
        document.getElementById('phone').value = currentUser.phone || '';
        document.getElementById('dateOfBirth').value = currentUser.dateOfBirth || '';
        document.getElementById('gender').value = currentUser.gender || '';
        document.getElementById('profileImg').src = currentUser.profileImg || '/images/patient-profile.png';
        
        // Update header info
        const headerName = document.querySelector('.profile-info h2');
        const headerEmail = document.querySelector('.profile-info p');
        if (headerName) headerName.textContent = currentUser.fullname || 'Patient Name';
        if (headerEmail) headerEmail.textContent = currentUser.email || '';
    }

    // Image Upload
    const imageUpload = document.getElementById('imageUpload');
    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file (JPG, PNG, etc.)', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            showToast('Image size must be less than 2MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            document.getElementById('profileImg').src = event.target.result;
            
            try {
                await HealthcareStorage.auth.updateUser(currentUser.id, {
                    profileImg: event.target.result,
                    updatedAt: new Date().toISOString()
                });
                showToast('Profile image updated successfully!', 'success');
            } catch (error) {
                showToast('Failed to update profile image', 'error');
            }
        };
        reader.readAsDataURL(file);
    });

    // Profile Form
    const profileForm = document.getElementById('profileForm');
    const profileInputs = {
        fullname: document.getElementById('fullname'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        dateOfBirth: document.getElementById('dateOfBirth'),
        gender: document.getElementById('gender')
    };

    // Real-time validation
    Object.keys(profileInputs).forEach(key => {
        const input = profileInputs[key];
        
        input.addEventListener('blur', () => {
            if (input.value.trim()) validateField(input, key);
        });
        
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                clearValidation(input);
            }
        });
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate all fields
        let isValid = true;
        Object.keys(profileInputs).forEach(key => {
            if (!validateField(profileInputs[key], key)) {
                isValid = false;
            }
        });

        if (!isValid) {
            showToast('Please fix all errors before submitting', 'error');
            return;
        }

        // Check if email is already taken by another user
        const newEmail = profileForm.email.value.trim().toLowerCase();
        const currentEmail = currentUser.email.toLowerCase();
        
        if (newEmail !== currentEmail) {
            try {
                const allUsers = await HealthcareStorage.users.getAll();
                const emailExists = allUsers.some(user => 
                    user.email.toLowerCase() === newEmail && user.id !== currentUser.id
                );
                
                if (emailExists) {
                    showError(profileInputs.email, 'This email is already registered to another account');
                    showToast('Email already in use by another user', 'error');
                    return;
                }
            } catch (error) {
                showToast('Error checking email availability', 'error');
                return;
            }
        }

        const submitBtn = profileForm.querySelector('.btn-primary');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const updates = {
                fullname: profileForm.fullname.value.trim(),
                email: profileForm.email.value.trim(),
                phone: profileForm.phone.value.trim(),
                dateOfBirth: profileForm.dateOfBirth.value,
                gender: profileForm.gender.value,
                updatedAt: new Date().toISOString()
            };

            await HealthcareStorage.auth.updateUser(currentUser.id, updates);
            Object.assign(currentUser, updates);
            
            // Update header
            document.querySelector('.profile-info h2').textContent = updates.fullname;
            document.querySelector('.profile-info p').textContent = updates.email;
            
            showToast('Profile updated successfully!', 'success');
        } catch (error) {
            showToast('Failed to update profile', 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Password Form
    const passwordForm = document.getElementById('passwordForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    newPasswordInput.addEventListener('input', () => updatePasswordStrength(newPasswordInput));

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const current = currentPasswordInput.value;
        const newPass = newPasswordInput.value;
        const confirm = confirmPasswordInput.value;

        [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(clearValidation);

        if (currentUser.password !== current) {
            showError(currentPasswordInput, 'Current password is incorrect');
            return;
        }

        const passwordError = validators.password(newPass);
        if (passwordError) {
            showError(newPasswordInput, passwordError);
            return;
        }

        if (newPass !== confirm) {
            showError(confirmPasswordInput, 'Passwords do not match');
            return;
        }

        if (newPass === current) {
            showError(newPasswordInput, 'New password must be different from current password');
            return;
        }

        const submitBtn = passwordForm.querySelector('.btn-primary');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            await HealthcareStorage.auth.updateUser(currentUser.id, { 
                password: newPass,
                updatedAt: new Date().toISOString()
            });
            showToast('Password changed successfully!', 'success');
            passwordForm.reset();
            
            const strengthDiv = newPasswordInput.closest('.form-group').querySelector('.password-strength');
            if (strengthDiv) strengthDiv.remove();
            const hint = newPasswordInput.closest('.form-group').querySelector('.password-hint');
            if (hint) hint.remove();
        } catch (error) {
            showToast('Failed to change password', 'error');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Delete Account
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const deleteModal = document.getElementById('deleteAccountModal');
    const deleteForm = document.getElementById('deleteAccountForm');
    const deleteConfirmPassword = deleteForm.querySelector('input[type="password"]');

    deleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'block';
        deleteConfirmPassword.value = '';
        const errorDiv = document.getElementById('passwordError');
        if (errorDiv) errorDiv.textContent = '';
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => deleteModal.style.display = 'none';
    });

    window.onclick = (event) => {
        if (event.target === deleteModal) deleteModal.style.display = 'none';
    };

    deleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = deleteConfirmPassword.value;
        const errorDiv = document.getElementById('passwordError');

        if (!password) {
            errorDiv.textContent = 'Password is required';
            return;
        }

        if (currentUser.password !== password) {
            errorDiv.textContent = 'Incorrect password. Please try again.';
            return;
        }

        const submitBtn = deleteForm.querySelector('.btn-danger');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            await HealthcareStorage.users.delete(currentUser.id);
            showToast('Account deleted successfully', 'success');
            setTimeout(() => {
                HealthcareStorage.auth.logout();
                window.location.href = '../../html/Auth/login.html';
            }, 2000);
        } catch (error) {
            errorDiv.textContent = 'Failed to delete account. Please try again.';
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Logout
    const logoutBtn = document.querySelector('.logout-link');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                HealthcareStorage.auth.logout();
                window.location.href = '../../html/Auth/login.html';
            }
        });
    }

    // Initialize
    await loadProfileData();
});