document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Current User Data
    const currentUser = HealthcareStorage.auth.getCurrentUser();

    if (!currentUser || currentUser.role !== 'doctor') {
        window.location.href = '/html/Auth/login.html';
        return;
    }

    const profileForm = document.getElementById('profileForm');
    const doctorNameDisplay = document.querySelector('.profile-card h3');
    const doctorSpecialtyDisplay = document.querySelector('.profile-card p');
    const doctorAvatar = document.querySelector('.avatar-container img');
    const userNameNav = document.querySelector('.user-name');
    const salaryDisplay = document.getElementById('doctor-salary');

    // Fetch fresh data from storage
    let freshUser = await HealthcareStorage.users.getById(currentUser.id);
    if (!freshUser) freshUser = currentUser;

    // 2. Populate Current Data
    const populateUI = (user) => {
        if (profileForm) {
            const inputs = profileForm.querySelectorAll('input');
            const specialtySelect = document.getElementById('specialization-select');

            let fullName = user.fullname || '';
            let cleanName = fullName.toLowerCase().startsWith('dr. ') ? fullName.substring(4).trim() : fullName;

            const nameParts = cleanName.split(' ');
            if (inputs[0]) inputs[0].value = nameParts[0] || '';
            if (inputs[1]) inputs[1].value = nameParts.slice(1).join(' ') || '';
            if (inputs[2]) inputs[2].value = user.email || '';

            if (specialtySelect) specialtySelect.value = user.specialty || '';
        }

        const displayName = user.fullname.toLowerCase().startsWith('dr. ') ? user.fullname : `Dr. ${user.fullname}`;
        if (doctorNameDisplay) doctorNameDisplay.textContent = displayName;
        if (doctorSpecialtyDisplay) doctorSpecialtyDisplay.textContent = user.specialty || 'General Practitioner';
        if (doctorAvatar && user.profileImg) {
            doctorAvatar.src = user.profileImg;
            doctorAvatar.onerror = () => { doctorAvatar.src = '/images/doctor-profile.png'; };
        }

        // Nav name
        let navName = user.fullname.toLowerCase().startsWith('dr. ') ? user.fullname.substring(4) : user.fullname;
        navName = navName.split(' ')[0];
        if (userNameNav) userNameNav.textContent = `Dr. ${navName}`;

        // Display ACTUAL salary from database with formatting
        if (salaryDisplay) {
            const salary = user.salary || 0;
            salaryDisplay.textContent = `${salary.toLocaleString()} EGP`;
        }

        // Appointment Price
        const priceInput = document.getElementById('appointment-price');
        if (priceInput) priceInput.value = user.appointmentPrice || 0;
    };

    populateUI(freshUser);

    // 3. Handle Save Changes
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = profileForm.querySelectorAll('input');
            const specialtySelect = document.getElementById('specialization-select');
            const priceInput = document.getElementById('appointment-price');

            const updatedData = {
                fullname: `Dr. ${inputs[0].value} ${inputs[1].value}`.trim(),
                email: inputs[2].value,
                specialty: specialtySelect ? specialtySelect.value : freshUser.specialty,
                appointmentPrice: priceInput ? parseInt(priceInput.value) : freshUser.appointmentPrice,
                updatedAt: new Date().toISOString()
            };

            try {
                const updatedUser = await HealthcareStorage.auth.updateUser(currentUser.id, updatedData);
                if (window.showToast) window.showToast('Profile updated successfully!', 'success');
                populateUI(updatedUser);
            } catch (error) {
                console.error('Update failed:', error);
                if (window.showToast) window.showToast('Failed to update profile.', 'error');
            }
        });
    }

    // Image Upload
    const editPhotoBtn = document.querySelector('.edit-photo-btn');
    const changePhotoBtn = document.querySelector('.profile-card .submit-btn');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                if (window.showToast) window.showToast('Processing image...', 'default');
                const persistentData = await HealthcareStorage.utils.processImage(file);
                if (doctorAvatar) doctorAvatar.src = persistentData;
                const updatedUser = await HealthcareStorage.auth.updateUser(currentUser.id, {
                    profileImg: persistentData,
                    updatedAt: new Date().toISOString()
                });
                // Update localStorage
                localStorage.setItem('healthcare_current_user', JSON.stringify(updatedUser));
                if (window.showToast) window.showToast('Profile picture updated!', 'success');
            } catch (err) {
                console.error('Detailed Error info:', err);
                const errorMsg = err.message || 'Failed to save image.';
                if (window.showToast) window.showToast(`Error: ${errorMsg}`, 'error');
            }
        }
    });

    if (editPhotoBtn) editPhotoBtn.addEventListener('click', () => fileInput.click());
    if (changePhotoBtn) changePhotoBtn.addEventListener('click', () => fileInput.click());
});
