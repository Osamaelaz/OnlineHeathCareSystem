document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = HealthcareStorage.auth.getCurrentUser();

    if (!currentUser || currentUser.role !== 'doctor') {
        window.location.href = '/html/Auth/login.html';
        return;
    }

    const workingDaysForm = document.getElementById('workingDaysForm');
    const dayCheckboxes = document.querySelectorAll('.day-item input');
    const dayLabels = document.querySelectorAll('.day-item');
    const workStartInput = document.getElementById('work-start');
    const workEndInput = document.getElementById('work-end');

    // Fetch fresh data from storage
    let freshUser = await HealthcareStorage.users.getById(currentUser.id);
    if (!freshUser) freshUser = currentUser;

    // Populate current working hours
    if (freshUser.workingHours) {
        if (freshUser.workingHours.days) {
            dayCheckboxes.forEach(cb => {
                if (freshUser.workingHours.days.includes(cb.value)) {
                    cb.checked = true;
                    cb.parentElement.style.background = 'var(--primary)';
                    cb.parentElement.style.color = 'white';
                    cb.parentElement.style.borderColor = 'var(--primary)';
                }
            });
        }
        if (workStartInput) workStartInput.value = freshUser.workingHours.start || '09:00';
        if (workEndInput) workEndInput.value = freshUser.workingHours.end || '17:00';
    }

    // Add visual feedback for checkbox selection
    dayLabels.forEach(label => {
        label.addEventListener('click', () => {
            const checkbox = label.querySelector('input');
            setTimeout(() => {
                if (checkbox.checked) {
                    label.style.background = 'var(--primary)';
                    label.style.color = 'white';
                    label.style.borderColor = 'var(--primary)';
                } else {
                    label.style.background = '';
                    label.style.color = '';
                    label.style.borderColor = 'var(--border)';
                }
            }, 10);
        });
    });

    // Handle form submission
    if (workingDaysForm) {
        workingDaysForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedDays = Array.from(dayCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            if (selectedDays.length === 0) {
                if (window.showToast) window.showToast('Please select at least one working day', 'error');
                return;
            }

            if (!workStartInput.value || !workEndInput.value) {
                if (window.showToast) window.showToast('Please set working hours', 'error');
                return;
            }

            const updatedData = {
                workingHours: {
                    days: selectedDays,
                    start: workStartInput.value,
                    end: workEndInput.value
                },
                updatedAt: new Date().toISOString()
            };

            try {
                const updatedUser = await HealthcareStorage.auth.updateUser(currentUser.id, updatedData);
                // Update localStorage
                localStorage.setItem('healthcare_current_user', JSON.stringify(updatedUser));
                if (window.showToast) window.showToast('Working days updated successfully!', 'success');
            } catch (error) {
                console.error('Update failed:', error);
                if (window.showToast) window.showToast('Failed to update working days.', 'error');
            }
        });
    }
});
