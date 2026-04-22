document.addEventListener('DOMContentLoaded', async () => {
    // Get form elements
    const adminProfileForm = document.getElementById('adminProfileForm');
    const adminProfileImg = document.getElementById('adminProfileImg');
    const adminProfilePreview = document.getElementById('adminProfilePreview');
    const adminFullname = document.getElementById('adminFullname');
    const adminEmail = document.getElementById('adminEmail');
    const adminPassword = document.getElementById('adminPassword');
    const adminConfirmPassword = document.getElementById('adminConfirmPassword');
    const adminStatus = document.getElementById('adminStatus');
    const adminId = document.getElementById('adminId');
    const saveAdminProfile = document.getElementById('saveAdminProfile');
    const cancelBtn = document.getElementById('cancelBtn');

    let currentAdminUser = null;
    let newProfileImage = null;

    // Toast notification helper
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Load Admin Profile Data
    async function loadAdminProfile() {
        try {
            currentAdminUser = HealthcareStorage.auth.getCurrentUser();
            
            if (!currentAdminUser) {
                showToast('Please login again', 'error');
                setTimeout(() => {
                    HealthcareStorage.auth.logout();
                }, 1500);
                return;
            }

            // Populate form fields
            adminFullname.value = currentAdminUser.fullname || '';
            adminEmail.value = currentAdminUser.email || '';
            adminPassword.value = '';
            adminConfirmPassword.value = '';
            adminId.textContent = currentAdminUser.id || '--';
            
            const status = currentAdminUser.status || 'active';
            adminStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            adminStatus.className = `badge badge-${status}`;

            // Set profile image
            const profileImg = currentAdminUser.profileImg || '/images/admin-profile.png';
            adminProfilePreview.src = profileImg;

            // Update top bar
            updateAdminInfo();

        } catch (error) {
            console.error('Error loading admin profile:', error);
            showToast('Failed to load profile data', 'error');
        }
    }

    // Update top bar with admin info
    function updateAdminInfo() {
        const user = HealthcareStorage.auth.getCurrentUser();
        if (user) {
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) {
                userNameElement.textContent = user.fullname || 'Admin';
            }

            const profileImgElement = document.querySelector('.profile-img');
            if (profileImgElement) {
                profileImgElement.src = user.profileImg || '/images/admin-profile.png';
            }
        }
    }

    // Handle Profile Image Upload
    adminProfileImg.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showToast('Processing image...', 'info');
            const imageData = await HealthcareStorage.utils.processImage(file);
            adminProfilePreview.src = imageData;
            newProfileImage = imageData;
            showToast('Image uploaded successfully', 'success');
        } catch (error) {
            console.error('Error processing image:', error);
            showToast('Failed to process image', 'error');
        }
    });

    // Click on preview to trigger file input
    adminProfilePreview.addEventListener('click', () => {
        adminProfileImg.click();
    });

    // Password Toggle
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input && input.type === 'password') {
                input.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else if (input && input.type === 'text') {
                input.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        });
    });

    // Handle Form Submission
    adminProfileForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const fullname = adminFullname.value.trim();
        const email = adminEmail.value.trim();
        const password = adminPassword.value;
        const confirmPassword = adminConfirmPassword.value;

        // Validation
        if (!fullname) {
            showToast('Full name is required', 'error');
            adminFullname.focus();
            return;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Valid email is required', 'error');
            adminEmail.focus();
            return;
        }

        // Check if password is being changed
        if (password) {
            if (password.length < 8) {
                showToast('Password must be at least 8 characters', 'error');
                adminPassword.focus();
                return;
            }

            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                adminConfirmPassword.focus();
                return;
            }

            // Validate password strength
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            if (!passwordPattern.test(password)) {
                showToast('Password must contain uppercase, lowercase, number, and special character', 'error');
                adminPassword.focus();
                return;
            }
        }

        try {
            saveAdminProfile.disabled = true;
            saveAdminProfile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            showToast('Updating profile...', 'info');

            // Prepare update data
            const updateData = {
                fullname: fullname,
                email: email,
                updatedAt: new Date().toISOString()
            };

            // Add password if changed
            if (password) {
                updateData.password = password;
            }

            // Add profile image if changed
            if (newProfileImage) {
                updateData.profileImg = newProfileImage;
            }

            // Update user in database
            const updatedUser = await HealthcareStorage.auth.updateUser(currentAdminUser.id, updateData);

            // Update current user in localStorage
            localStorage.setItem('healthcare_current_user', JSON.stringify(updatedUser));

            // Update UI elements
            updateAdminInfo();

            showToast('Profile updated successfully!', 'success');
            
            // Reset form state
            setTimeout(() => {
                newProfileImage = null;
                adminPassword.value = '';
                adminConfirmPassword.value = '';
                saveAdminProfile.disabled = false;
                saveAdminProfile.innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
            }, 1500);

        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Failed to update profile. Please try again.', 'error');
            saveAdminProfile.disabled = false;
            saveAdminProfile.innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
        }
    });

    // Cancel button - go back to dashboard
    cancelBtn.addEventListener('click', () => {
        window.location.href = '/html/Addmin/AdminDashBoard/AdminDashboard.html';
    });

    // Initial load
    await loadAdminProfile();
});

