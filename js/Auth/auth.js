window.addEventListener('load', () => {
    const body = document.body;

    // Set max date for date of birth field to today
    const dobField = document.getElementById('dob');
    if (dobField) {
        const today = new Date().toISOString().split('T')[0];
        dobField.max = today;
    }

    // Role pre-selection from URL (useful for redirection after registration)
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedRole = urlParams.get('role');
    if (preSelectedRole) {
        const roleRadio = document.querySelector(`input[name="role"][value="${preSelectedRole}"]`);
        if (roleRadio) {
            roleRadio.checked = true;

            // If the toggle function exists, call it. Otherwise, it will be called 
            // by its own initialization logic later in the file.
            if (typeof window.toggleRegistrationForm === 'function') {
                window.toggleRegistrationForm();
            }
        }
    }

    function showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.className = `toast show ${type}`;

        setTimeout(() => {
            toast.className = toast.className.replace('show', '');
        }, 3000);
    }

    window.showToast = showToast;

    const authThemeBtn = document.getElementById('authThemeToggle');
    if (authThemeBtn) {
        authThemeBtn.addEventListener('click', () => {
            const isDark = body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                updateAuthThemeIcon(false);
            } else {
                body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                updateAuthThemeIcon(true);
            }
        });
        const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) body.setAttribute('data-theme', 'dark');
        updateAuthThemeIcon(isDark);
    }

    function updateAuthThemeIcon(isDark) {
        if (!authThemeBtn) return;
        const icon = authThemeBtn.querySelector('i');
        if (isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    function showError(input, message) {
        const formGroup = input.closest('.form-group') || input.closest('.form-check');
        const existingSuccess = formGroup.querySelector('.success-message');
        if (existingSuccess) existingSuccess.remove();
        input.classList.remove('input-success');

        const existingError = formGroup.querySelector('.error-message');
        if (existingError) {
            existingError.innerText = message;
            return;
        }

        const error = document.createElement('div');
        error.className = 'error-message';
        error.innerText = message;
        formGroup.appendChild(error);
        input.classList.add('input-error');
    }

    function showSuccess(input, message = 'Valid') {
        const formGroup = input.closest('.form-group') || input.closest('.form-check');
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) existingError.remove();
        input.classList.remove('input-error');

        if (formGroup.querySelector('.success-message')) return;

        const success = document.createElement('div');
        success.className = 'success-message';
        success.innerText = message;
        formGroup.appendChild(success);
        input.classList.add('input-success');

        setTimeout(() => {
            success.style.opacity = '0';
            success.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                success.remove();
                input.classList.remove('input-success');
            }, 500);
        }, 1000);
    }

    function clearAllErrors(form) {
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        form.querySelectorAll('.success-message').forEach(el => el.remove());
        form.querySelectorAll('.input-success').forEach(el => el.classList.remove('input-success'));
    }

    const patterns = {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        phone: /^01[0125][0-9]{8}$/,
        license: /^[A-Z]{2,4}-[A-Z]{2,4}-\d{4}-\d{6,8}$/,
        experience: /^[0-9]+$/,
        name: /^[a-zA-Z\s\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]{2,50}$/
    };
    window.patterns = patterns;

    function setupRealtimeValidation(input, type) {
        input.addEventListener('blur', () => {
            const val = input.value.trim();
            if (val === '') {
                input.classList.remove('input-error', 'input-success');
                const fg = input.closest('.form-group');
                if (fg && fg.querySelector('.error-message')) fg.querySelector('.error-message').remove();
                if (fg && fg.querySelector('.success-message')) fg.querySelector('.success-message').remove();
                return;
            }

            let isValid = false;
            let errorMsg = '';

            if (type === 'email') {
                isValid = patterns.email.test(val);
                errorMsg = 'Invalid format. Example: osamaelazab@gmail.com';
            } else if (type === 'password') {
                isValid = patterns.password.test(val);
                errorMsg = 'Weak password';
            } else if (type === 'phone') {
                isValid = patterns.phone.test(val);
                errorMsg = 'Invalid format. Example: 01228139573';
            } else if (type === 'license') {
                isValid = patterns.license.test(val);
                errorMsg = 'Format: LIC-EGY-2024-123456';
            } else if (type === 'experience') {
                const years = parseInt(val);
                isValid = patterns.experience.test(val) && years >= 0 && years <= 60;
                errorMsg = 'Experience must be between 0-60 years';
            } else if (type === 'name') {
                isValid = patterns.name.test(val);
                if (!isValid) {
                    if (/^\d+$/.test(val)) {
                        errorMsg = 'Name cannot contain only numbers';
                    } else if (/^[^\w\s\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+$/.test(val)) {
                        errorMsg = 'Name cannot contain special characters';
                    } else if (val.length < 2) {
                        errorMsg = 'Name must be at least 2 characters';
                    } else if (val.length > 50) {
                        errorMsg = 'Name must be less than 50 characters';
                    } else {
                        errorMsg = 'Please enter a valid name';
                    }
                }
            }

            if (isValid) showSuccess(input);
            else showError(input, errorMsg);
        });
    }

    const emailFields = document.querySelectorAll('input[type="email"]');
    emailFields.forEach(f => {
        // Skip real-time validation for login/admin pages (main form and modals)
        const isLoginPage = document.getElementById('loginForm') || document.getElementById('adminLoginForm');
        if (!isLoginPage) {
            setupRealtimeValidation(f, 'email');
        }
    });

    const nameFields = document.querySelectorAll('#fullname');
    nameFields.forEach(f => setupRealtimeValidation(f, 'name'));

    const phoneFields = document.querySelectorAll('input[type="tel"], #phone');
    phoneFields.forEach(f => setupRealtimeValidation(f, 'phone'));

    const experienceFields = document.querySelectorAll('#experience');
    experienceFields.forEach(f => {
        f.addEventListener('change', () => {
            if (f.value) showSuccess(f);
            else showError(f, 'Please select your experience');
        });
    });

    const licenseFields = document.querySelectorAll('#license');
    licenseFields.forEach(f => setupRealtimeValidation(f, 'license'));

    // Date of birth validation - cannot be from future
    const dobFields = document.querySelectorAll('#dob');
    dobFields.forEach(field => {
        field.addEventListener('blur', () => {
            const val = field.value;
            if (val === '') {
                field.classList.remove('input-error', 'input-success');
                const fg = field.closest('.form-group');
                if (fg && fg.querySelector('.error-message')) fg.querySelector('.error-message').remove();
                if (fg && fg.querySelector('.success-message')) fg.querySelector('.success-message').remove();
                return;
            }

            const selectedDate = new Date(val);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate > today) {
                showError(field, 'Date of birth cannot be in the future');
            } else {
                const age = today.getFullYear() - selectedDate.getFullYear();
                const monthDiff = today.getMonth() - selectedDate.getMonth();
                const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < selectedDate.getDate()) ? age - 1 : age;

                if (actualAge > 120) {
                    showError(field, 'Invalid date of birth');
                } else {
                    showSuccess(field, `Age: ${actualAge} years`);
                }
            }
        });
    });

    // Time range validation
    const startTimeFields = document.querySelectorAll('#startTime');
    const endTimeFields = document.querySelectorAll('#endTime');

    startTimeFields.forEach(startField => {
        startField.addEventListener('change', () => {
            const endField = document.getElementById('endTime');
            if (endField && endField.value) {
                validateTimeRange(startField, endField);
            }
        });
    });

    endTimeFields.forEach(endField => {
        endField.addEventListener('change', () => {
            const startField = document.getElementById('startTime');
            if (startField && startField.value) {
                validateTimeRange(startField, endField);
            }
        });
    });

    function validateTimeRange(startField, endField) {
        const startTime = startField.value;
        const endTime = endField.value;

        if (startTime && endTime) {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);

            if (end <= start) {
                showError(endField, 'End time must be after start time');
            } else {
                // Clear any previous errors
                const startGroup = startField.closest('.form-group');
                const endGroup = endField.closest('.form-group');
                if (startGroup) {
                    const errorMsg = startGroup.querySelector('.error-message');
                    if (errorMsg && errorMsg.textContent.includes('End time')) errorMsg.remove();
                }
                if (endGroup) {
                    const errorMsg = endGroup.querySelector('.error-message');
                    if (errorMsg && errorMsg.textContent.includes('End time')) errorMsg.remove();
                }
                showSuccess(startField);
                showSuccess(endField);
            }
        }
    }

    const passwordFields = document.querySelectorAll('input[type="password"]#password, input[type="password"]#newPassword');
    passwordFields.forEach(field => {
        // Skip real-time validation for login/admin pages
        const isLoginPage = document.getElementById('loginForm') || document.getElementById('adminLoginForm');
        if (isLoginPage) return;

        field.addEventListener('blur', () => {
            const val = field.value.trim();
            if (val === '') {
                field.classList.remove('input-error', 'input-success');
                const fg = field.closest('.form-group');
                if (fg && fg.querySelector('.error-message')) fg.querySelector('.error-message').remove();
                if (fg && fg.querySelector('.success-message')) fg.querySelector('.success-message').remove();
                return;
            }

            if (patterns.password.test(val)) {
                showSuccess(field);
            } else {
                showError(field, 'Weak password. Use 8+ chars, uppercase, lowercase, number, special char');
            }
        });
    });

    const confirmPasswordFields = document.querySelectorAll('input[type="password"]#confirmPassword, input[type="password"]#confirmNewPassword');
    confirmPasswordFields.forEach(field => {
        field.addEventListener('blur', () => {
            const val = field.value.trim();
            if (val === '') {
                field.classList.remove('input-error', 'input-success');
                const fg = field.closest('.form-group');
                if (fg && fg.querySelector('.error-message')) fg.querySelector('.error-message').remove();
                if (fg && fg.querySelector('.success-message')) fg.querySelector('.success-message').remove();
                return;
            }

            const passwordField = document.getElementById(field.id === 'confirmPassword' ? 'password' : 'newPassword');
            if (passwordField && val === passwordField.value) {
                showSuccess(field, 'Passwords match');
            } else {
                showError(field, 'Passwords do not match');
            }
        });
    });

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const rememberMeCheckbox = document.getElementById('rememberMe');
        const emailInput = document.getElementById('email');
        const savedEmail = localStorage.getItem('savedEmail');
        const savedRole = localStorage.getItem('savedRole');

        if (savedEmail && rememberMeCheckbox) {
            emailInput.value = savedEmail;
            rememberMeCheckbox.checked = true;

            if (savedRole) {
                const roleRadio = document.querySelector(`input[name="role"][value="${savedRole}"]`);
                if (roleRadio) roleRadio.checked = true;
            }
        }

        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAllErrors(loginForm);
            console.log('Login form submitted');
            showToast('Processing Login...', 'default');

            const email = emailInput.value.trim();
            const password = document.getElementById('password').value;


            if (!email) { showError(emailInput, 'Required'); return; }
            if (!password) { showError(document.getElementById('password'), 'Required'); return; }

            try {
                const user = await HealthcareStorage.auth.login(email, password);
                console.log('Authenticated user:', user);
                if (user) {


                    const role = user.role;

                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('savedEmail', email);
                        localStorage.setItem('savedRole', role);
                    } else {
                        localStorage.removeItem('savedEmail');
                        localStorage.removeItem('savedRole');
                    }

                    showToast('Login Successful!', 'success');
                    setTimeout(() => {
                        if (role === 'patient') {
                            HealthcareStorage.navigate('/html/patient/patient.html');
                        } else if (role === 'doctor') {
                            HealthcareStorage.navigate('/html/Doctor/doctor-db.html');
                        }
                    }, 1000);
                } else {
                    showToast('Login Failed: Invalid Credentials', 'error');
                    showError(emailInput, 'Invalid credentials');
                }
            } catch (error) {
                showToast(error.message, 'error');
                showError(emailInput, error.message);
            }
        });

        const registerBtn = document.getElementById('goToRegister');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                window.location.href = 'register.html';
            });
        }
    }

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        const adminRememberMe = document.getElementById('adminRememberMe');
        const emailInput = document.getElementById('email');
        const savedAdminEmail = localStorage.getItem('savedAdminEmail');

        if (savedAdminEmail && adminRememberMe) {
            emailInput.value = savedAdminEmail;
            adminRememberMe.checked = true;
        }

        adminLoginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            clearAllErrors(adminLoginForm);
            showToast('Verifying Admin Access...', 'default');

            const passwordInput = document.getElementById('password');
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!patterns.email.test(email)) {
                showError(emailInput, 'Invalid email format');
                return;
            }
            if (!password) {
                showError(passwordInput, 'Required');
                return;
            }

            try {
                const user = await HealthcareStorage.auth.login(email, password);

                if (user && user.role === 'admin') {
                    if (adminRememberMe && adminRememberMe.checked) {
                        localStorage.setItem('savedAdminEmail', email);
                    } else {
                        localStorage.removeItem('savedAdminEmail');
                    }

                    showToast('Admin Access Granted', 'success');
                    setTimeout(() => {
                        HealthcareStorage.navigate('/html/Addmin/AdminDashBoard/AdminDashboard.html');
                    }, 1000);
                } else if (user) {
                    showToast('No Admin privilege', 'error');
                    showError(emailInput, 'This account is not an administrator');
                } else {
                    showToast('Authentication Failed: Invalid credentials', 'error');
                    showError(emailInput, 'Invalid email or password');
                }
            } catch (error) {
                showToast(error.message, 'error');
                showError(emailInput, error.message);
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    const regImgInput = document.getElementById('regImg');
    const regImgPreview = document.getElementById('regImgPreview');
    let regProfilePath = '/images/patient-profile.png';

    if (registerForm) {
        if (regImgInput) {
            regImgInput.addEventListener('change', async function (e) {
                const file = e.target.files[0];
                if (file) {
                    try {
                        // REALLY STORE: Convert the physical file into a persistent string
                        showToast('Saving image...', 'default');
                        const persistentData = await HealthcareStorage.utils.processImage(file);

                        // Update preview
                        regImgPreview.src = persistentData;

                        // Update the path variable with the actual data
                        regProfilePath = persistentData;

                        showToast('Image stored successfully!', 'success');
                    } catch (err) {
                        console.error('Image processing failed:', err);
                        showToast('Failed to process image', 'error');
                    }
                }
            });
        }

        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            // Disable button and show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.7';
                submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            }

            try {
                clearAllErrors(registerForm);
                showToast('Verifying details...', 'default');

                let isValid = true;
                const roleInput = document.querySelector('input[name="role"]:checked');
                if (!roleInput) {
                    showToast('Please select a role', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.innerHTML = 'Create Account';
                    }
                    return;
                }
                const role = roleInput.value;

                const fullname = document.getElementById('fullname');
                const email = document.getElementById('email');
                const phone = document.getElementById('phone');
                const password = document.getElementById('password');
                const confirmPassword = document.getElementById('confirmPassword');

                if (!fullname.value.trim()) { showError(fullname, 'Required'); isValid = false; }
                else if (!patterns.name.test(fullname.value.trim())) {
                    if (/^\d+$/.test(fullname.value.trim())) {
                        showError(fullname, 'Name cannot contain only numbers');
                    } else if (/^[^\w\s\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+$/.test(fullname.value.trim())) {
                        showError(fullname, 'Name cannot contain special characters');
                    } else if (fullname.value.trim().length < 2) {
                        showError(fullname, 'Name must be at least 2 characters');
                    } else {
                        showError(fullname, 'Please enter a valid name');
                    }
                    isValid = false;
                }
                if (!patterns.email.test(email.value)) { showError(email, 'Invalid format'); isValid = false; }
                if (!patterns.phone.test(phone.value)) { showError(phone, 'Invalid format'); isValid = false; }
                if (!patterns.password.test(password.value)) { showError(password, 'Weak Password'); isValid = false; }
                if (password.value !== confirmPassword.value) { showError(confirmPassword, 'Mismatch'); isValid = false; }

                if (!isValid) {
                    showToast('Please fix errors in the form', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.innerHTML = 'Create Account';
                    }
                    return;
                }

                // Check if user already exists
                showToast('Checking email availability...', 'default');
                const emailTaken = await HealthcareStorage.auth.getUserByEmail(email.value);
                if (emailTaken) {
                    showToast(`Email already exists`, 'error');
                    showError(email, 'Email already registered');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = '1';
                        submitBtn.innerHTML = 'Create Account';
                    }
                    return;
                }

                const userData = {
                    fullname: fullname.value,
                    email: email.value,
                    phone: phone.value,
                    password: password.value,
                    role: role,
                    profileImg: regProfilePath
                };

                if (role === 'patient') {
                    userData.dateOfBirth = document.getElementById('dob').value;

                    showToast('Creating patient account...', 'default');
                    const newUser = await HealthcareStorage.users.create(userData);

                    // Auto-login: Save user as current user
                    localStorage.setItem('healthcare_current_user', JSON.stringify(newUser));

                    showToast('Registration Successful! Redirecting to your dashboard...', 'success');
                    setTimeout(() => {
                        HealthcareStorage.navigate('/html/patient/patient.html');
                    }, 1500);
                } else if (role === 'doctor') {


                    userData.specialty = document.getElementById('specialty').value;
                    userData.experience = document.getElementById('experience').value;
                    userData.appointmentPrice = document.getElementById('appointmentPrice').value;

                    // Defaults for approval
                    userData.salary = 0;
                    userData.status = 'pending';

                    showToast('Submitting application...', 'default');
                    await HealthcareStorage.doctorApplications.create(userData);
                    showToast('Application Submitted! Please wait for admin approval.', 'success');
                    setTimeout(() => {
                        window.location.href = `login.html?role=${role}`;
                    }, 2500);
                }

                function formatTime(time) {
                    const [hours, minutes] = time.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                    return `${displayHour}:${minutes} ${ampm}`;
                }
            } catch (error) {
                console.error('Registration Error:', error);
                showToast(error.message || 'An error occurred during registration', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerHTML = 'Create Account';
                }
            }
        });
    }

    window.toggleRegistrationForm = function () {
        const roleInputs = document.querySelectorAll('input[name="role"]');
        if (roleInputs.length === 0) return;

        const role = document.querySelector('input[name="role"]:checked').value;
        const patientFields = document.getElementById('patientFields');
        const doctorFields = document.getElementById('doctorFields');

        // Identify fields that should be required only for specific roles
        if (role === 'patient') {
            // Only use default if NOT a custom upload
            if (!regImgInput || !regImgInput.files || regImgInput.files.length === 0) {
                regProfilePath = '/images/patient-profile.png';
            }
            if (regImgPreview) regImgPreview.src = regProfilePath;
            if (patientFields) {
                patientFields.style.display = 'block';
                setTimeout(() => patientFields.style.opacity = '1', 10);
            }
            if (doctorFields) {
                doctorFields.style.opacity = '0';
                setTimeout(() => doctorFields.style.display = 'none', 300);
            }
            // Disable doctor fields so they aren't validated
            if (doctorFields) {
                doctorFields.querySelectorAll('input, select, textarea').forEach(field => {
                    field.disabled = true;
                });
            }
            // Enable patient fields
            if (patientFields) {
                patientFields.querySelectorAll('input, select, textarea').forEach(field => {
                    field.disabled = false;
                });
            }
        } else {
            // Only use default if NOT a custom upload
            if (!regImgInput || !regImgInput.files || regImgInput.files.length === 0) {
                regProfilePath = '/images/doctor-profile.png';
            }
            if (regImgPreview) regImgPreview.src = regProfilePath;
            if (patientFields) {
                patientFields.style.opacity = '0';
                setTimeout(() => patientFields.style.display = 'none', 300);
            }
            if (doctorFields) {
                doctorFields.style.display = 'block';
                setTimeout(() => doctorFields.style.opacity = '1', 10);
            }
            // Enable doctor fields
            if (doctorFields) {
                doctorFields.querySelectorAll('input, select, textarea').forEach(field => {
                    field.disabled = false;
                });
            }
            // Disable patient fields
            if (patientFields) {
                patientFields.querySelectorAll('input, select, textarea').forEach(field => {
                    field.disabled = true;
                });
            }
        }
    };


    if (document.querySelector('input[name="role"]')) {
        const radios = document.querySelectorAll('input[name="role"]');
        radios.forEach(r => r.addEventListener('change', toggleRegistrationForm));
        toggleRegistrationForm();
    }
});

function openForgotModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.classList.add('show');
        const s1 = document.getElementById('forgotStep1');
        const s2 = document.getElementById('forgotStep2');
        const s3 = document.getElementById('forgotStep3');
        if (s1) s1.style.display = 'block';
        if (s2) s2.style.display = 'none';
        if (s3) s3.style.display = 'none';
    }
}

function closeForgotModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.classList.remove('show');
}

window.onclick = function (event) {
    const modal = document.getElementById('forgotPasswordModal');
    if (event.target == modal) {
        closeForgotModal();
    }
}

window.addEventListener('load', () => {
    const forgotLinks = document.querySelectorAll('.forgot-link, #forgotPassword, #adminForgotPassword');
    forgotLinks.forEach(l => l.addEventListener('click', (e) => {
        if (!l.classList.contains('resend-link')) {
            e.preventDefault();
            openForgotModal();
        }
    }));

    document.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', closeForgotModal));
    document.querySelectorAll('.modal-back-btn').forEach(b => b.addEventListener('click', () => {
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
    }));

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('toggle-password')) {
            const input = e.target.previousElementSibling;
            if (input && (input.type === 'password' || input.type === 'text')) {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                e.target.classList.toggle('fa-eye');
                e.target.classList.toggle('fa-eye-slash');
            }
        }
    });

    let currentOTP = null;

    document.querySelectorAll('#sendOTPBtn, #adminSendOTPBtn, .resend-link').forEach(b => b.addEventListener('click', async (e) => {
        if (b.tagName === 'A') e.preventDefault();

        if (b.id.toLowerCase().includes('sendotpbtn')) {
            const emailInput = document.getElementById('resetEmail');
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email) {
                if (window.showToast) window.showToast('Please enter your email', 'error');
                return;
            }

            if (window.patterns && !window.patterns.email.test(email)) {
                if (window.showToast) window.showToast('Please enter a valid email address', 'error');
                return;
            }

            const user = await HealthcareStorage.auth.getUserByEmail(email);
            if (!user) {
                if (window.showToast) window.showToast(`Account with this email not found`, 'error');
                return;
            }
        }
        currentOTP = Math.floor(100000 + Math.random() * 900000);
        console.log('%c OTP Code : ' + currentOTP, 'background: #22c55e; color: white; padding: 4px; border-radius: 4px;');

        if (window.showToast) window.showToast(`OTP Sent to Email`, 'success');

        if (b.id && (b.id === 'sendOTPBtn' || b.id === 'adminSendOTPBtn')) {
            document.getElementById('forgotStep1').style.display = 'none';
            document.getElementById('forgotStep2').style.display = 'block';
            document.querySelectorAll('.otp-input').forEach(i => i.value = '');
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) firstInput.focus();
        }
    }));

    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (input.value.length > 1) input.value = input.value.slice(0, 1);
            if (input.value.length === 1) {
                const next = otpInputs[index + 1];
                if (next) next.focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && input.value === '') {
                const prev = otpInputs[index - 1];
                if (prev) prev.focus();
            }
        });
    });

    document.querySelectorAll('#verifyOTPBtn, #adminVerifyOTPBtn').forEach(b => b.addEventListener('click', () => {
        let enteredOTP = '';
        document.querySelectorAll('.otp-input').forEach(i => enteredOTP += i.value);

        if (enteredOTP === String(currentOTP)) {
            if (window.showToast) window.showToast('OTP Verified Successfully!', 'success');
            document.getElementById('forgotStep2').style.display = 'none';
            document.getElementById('forgotStep3').style.display = 'block';
        } else {
            if (window.showToast) window.showToast('Invalid OTP. Please try again.', 'error');
            const container = document.querySelector('.otp-container');
            if (container) {
                container.style.animation = 'none';
                container.offsetHeight;
                container.style.animation = 'shake 0.5s';
            }
        }
    }));

    document.querySelectorAll('#resetPasswordBtn, #adminResetPasswordBtn').forEach(b => b.addEventListener('click', async () => {
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmNewPassword').value;
        const email = document.getElementById('resetEmail').value.trim();

        if (!patterns.password.test(newPass)) {
            if (window.showToast) window.showToast('Weak Password: Use 8+ chars, Uppercase, Lowercase, Number, Special Char', 'error');
            return;
        }

        if (newPass !== confirmPass) {
            if (window.showToast) window.showToast('Passwords do not match', 'error');
            return;
        }

        const user = await HealthcareStorage.auth.getUserByEmail(email);
        if (user) {
            if (user.password === newPass) {
                if (window.showToast) window.showToast('New password cannot be the same as the old password', 'error');
                return;
            }

            await HealthcareStorage.auth.updateUser(user.id, { password: newPass });
            if (window.showToast) window.showToast('Password Reset Successfully!', 'success');
            setTimeout(closeForgotModal, 1500);
        } else {
            if (window.showToast) window.showToast('Error: Account not found', 'error');
        }
    }));
});

