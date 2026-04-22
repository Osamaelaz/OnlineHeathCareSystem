const initApp = () => {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const themeBtn = document.getElementById('themeToggle');
    const body = document.body;
    const html = document.documentElement;

    // --- Sidebar Logic ---
    function updateSidebarIcon() {
        if (!toggleBtn) return;
        const icon = toggleBtn.querySelector('i');
        if (!icon) return;

        if (sidebar?.classList.contains('collapsed')) {
            icon.className = 'fa-solid fa-bars-staggered';
        } else {
            icon.className = 'fa-solid fa-bars';
        }
    }

    function handleResize() {
        if (window.innerWidth <= 768) {
            sidebar?.classList.add('collapsed');
        } else {
            const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (!wasCollapsed) {
                sidebar?.classList.remove('collapsed');
            } else {
                sidebar?.classList.add('collapsed');
            }
        }
        updateSidebarIcon();
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
            updateSidebarIcon();
        });
    }

    // Initial Sidebar State
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar?.classList.add('collapsed');
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // --- Theme Logic ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
            body.setAttribute('data-theme', 'dark');
            updateThemeIcon(true);
        } else {
            html.removeAttribute('data-theme');
            body.removeAttribute('data-theme');
            updateThemeIcon(false);
        }
    };

    function updateThemeIcon(isDark) {
        if (!themeBtn) return;
        const icon = themeBtn.querySelector('i');
        if (!icon) return;
        if (isDark) {
            icon.className = 'fa-regular fa-sun';
        } else {
            icon.className = 'fa-regular fa-moon';
        }
    }

    // Apply saved theme immediately
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = html.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // --- Active Nav State ---
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && href !== '#' && currentPath.includes(href)) {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        }
    });

    // Handle manual clicks
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const href = item.getAttribute('href');
            if (!href || href === '#') {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // --- Global Profile Sync ---
    const updateGlobalProfile = () => {
        if (typeof HealthcareStorage === 'undefined' || !HealthcareStorage.auth) return;

        const currentUser = HealthcareStorage.auth.getCurrentUser();
        if (!currentUser) return;

        const htmlIndex = window.location.pathname.indexOf('/html/');
        let relativeRoot = '';
        if (htmlIndex !== -1) {
            const afterHtml = window.location.pathname.substring(htmlIndex + 6);
            const depth = afterHtml.split('/').filter(p => p).length;
            relativeRoot = '../'.repeat(depth + 1);
        }

        // Sync Profile Images
        const currentUserImages = document.querySelectorAll('.top-bar-right .profile-img, .user-profile .profile-img, .admin-info .profile-img');
        currentUserImages.forEach(img => {
            if (currentUser.profileImg) {
                let finalPath = currentUser.profileImg;
                if (finalPath.startsWith('/') && relativeRoot) {
                    finalPath = relativeRoot + finalPath.substring(1);
                }
                img.src = finalPath;
                img.onerror = () => {
                    const defaultImg = currentUser.role === 'admin' ? 'admin-profile.png' :
                        currentUser.role === 'doctor' ? 'doctor-profile.png' : 'patient-profile.png';
                    img.src = (relativeRoot || '') + 'images/' + defaultImg;
                };
            }
        });

        // Sync Names
        const nameElements = document.querySelectorAll('.top-bar-right .user-name, .user-profile .user-name, .admin-info .admin-name, .welcome-section h1, .welcome-card h2');
        nameElements.forEach(el => {
            let fullName = currentUser.fullname || 'User';
            let cleanName = fullName.toLowerCase().startsWith('dr. ') ? fullName.substring(4).trim() : fullName;
            let firstName = cleanName.split(' ')[0];

            if (el.tagName === 'H1' || el.tagName === 'H2') {
                const greeting = el.textContent.includes(',') ? el.textContent.split(',')[0] : (el.textContent.includes('Welcome') ? 'Welcome' : 'Hello');
                const nameToUse = (currentUser.role === 'doctor') ? (fullName.toLowerCase().startsWith('dr. ') ? fullName : `Dr. ${fullName}`) : firstName;
                el.innerHTML = `${greeting}, ${nameToUse}! 👋`;
            } else {
                const displayName = (currentUser.role === 'doctor') ? (fullName.toLowerCase().startsWith('dr. ') ? `Dr. ${firstName}` : `Dr. ${firstName}`) : firstName;
                el.textContent = (currentUser.role === 'doctor' && !displayName.startsWith('Dr.')) ? `Dr. ${displayName}` : displayName;
            }
        });
    };

    updateGlobalProfile();

    // --- Toast Notifications ---
    window.showToast = function (message, type = 'success') {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    };

    // Global password toggle
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-password')) {
            const input = e.target.previousElementSibling;
            if (input && (input.type === 'password' || input.type === 'text')) {
                input.type = input.type === 'password' ? 'text' : 'password';
                e.target.classList.toggle('fa-eye');
                e.target.classList.toggle('fa-eye-slash');
            }
        }
    });

    // Global Logout Listener
    document.addEventListener('click', (e) => {
        const logoutBtn = e.target.closest('.nav-item[data-tooltip="Logout"], .nav-item:has(.fa-right-from-bracket), a[href*="logout"]');
        const isLogoutText = e.target.closest('.nav-item') && e.target.closest('.nav-item').textContent.includes('Logout');

        if (logoutBtn || isLogoutText) {
            if (typeof HealthcareStorage !== 'undefined' && HealthcareStorage.auth) {
                e.preventDefault();
                HealthcareStorage.auth.logout();
            }
        }
    });
};

document.addEventListener('DOMContentLoaded', initApp);
