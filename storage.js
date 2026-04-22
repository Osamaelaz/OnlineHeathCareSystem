// DATABASE CONFIGURATION
const API_URL = 'http://localhost:3000';

const STORAGE_KEYS = {
  CURRENT_USER: 'healthcare_current_user',
  SAVED_EMAIL: 'savedEmail',
  SAVED_ROLE: 'savedRole',
  SAVED_ADMIN_EMAIL: 'savedAdminEmail',
  THEME: 'theme'
};

// --- CORE UTILS ---

/**
 * Universal helper to handle fetch requests
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);
    throw error;
  }
}

const HealthcareStorage = {
  // --- SESSION MANAGEMENT (LocalStorage) ---
  auth: {
    /**
     * Authenticate user against JSON Server
     */
    login: async function (email, password) {
      try {
        const users = await apiRequest(`/users?email=${email}&password=${password}`);
        const user = users[0];
        console.log('Found user:', user);
        if (user) {
          if (user.status !== 'active') {
            throw new Error('Account is ' + user.status);
          }
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
          return user;
        }
        return null;
      } catch (error) {
        throw error;
      }
    },

    logout: function () {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

      const isSubDir = window.location.pathname.includes('/html/');
      let rootPath = '';

      if (isSubDir) {
        // Find how many levels deep we are from /html/
        const pathAfterHtml = window.location.pathname.split('/html/')[1];
        const depth = pathAfterHtml.split('/').filter(p => p).length;
        rootPath = '../'.repeat(depth + 1); // +1 to get out of /html/ itself
      }

      // Check if we are logging out from an admin session
      const isAdmin = window.location.pathname.includes('/Admin/') || window.location.pathname.includes('admin-dashboard');

      if (isAdmin) {
        window.location.href = rootPath + 'html/Auth/admin-login.html';
      } else {
        // Redirect to landing page (index.html)
        window.location.href = rootPath + 'index.html';
      }
    },


    getCurrentUser: function () {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      const user = JSON.parse(data);
      if (!user.profileImg) {
        // Find how many levels deep we are to point to /images/ correctly
        const path = window.location.pathname;
        let prefix = '';
        if (path.includes('/html/Addmin/') || path.includes('/html/Doctor/') || path.includes('/html/patient/')) {
            prefix = '../../../';
        } else if (path.includes('/html/Auth/')) {
            prefix = '../../';
        }

        if (user.role === 'admin') user.profileImg = prefix + 'images/admin-profile.png';
        else if (user.role === 'doctor') user.profileImg = prefix + 'images/doctor-profile.png';
        else user.profileImg = prefix + 'images/patient-profile.png';
      }
      return user;
    },

    // Validate user session against database
    validateSession: async function () {
      const user = this.getCurrentUser();
      if (!user) return null;

      try {
        // Check if user still exists in database
        const dbUser = await apiRequest(`/users/${user.id}`);
        if (!dbUser) {
          console.warn('User not found in database, clearing session');
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          return null;
        }
        // Update local user data if changed
        if (JSON.stringify(user) !== JSON.stringify(dbUser)) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(dbUser));
          return dbUser;
        }
        return user;
      } catch (error) {
        // User not found (404) or other error
        console.warn('Session validation failed:', error);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        return null;
      }
    },

    getUserByEmail: async function (email) {
      const users = await apiRequest(`/users?email=${email}`);
      return users[0] || null;
    },

    updateUser: async function (userId, updates) {
      const updatedUser = await apiRequest(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });

      const current = this.getCurrentUser();
      if (current && current.id === userId) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      }
      return updatedUser;
    },

    bindLogout: function (selector = '.logout-link, [data-logout], .sidebar-footer .nav-item, .sidebar-footer a') {
      document.querySelectorAll(selector).forEach(el => {
        if (el.textContent.toLowerCase().includes('logout') || el.innerHTML.toLowerCase().includes('from-bracket')) {
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
              this.logout();
            }
          });
        }
      });
    }
  },

  // --- DATA MANAGEMENT (Fetch API) ---

  users: {
    getAll: () => apiRequest('/users'),
    getById: (id) => apiRequest(`/users/${id}`),
    create: (userData) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({ ...userData, status: 'active', createdAt: new Date().toISOString() })
    }),
    delete: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
    getAllPatients: () => apiRequest('/users?role=patient'),
    getAllDoctors: () => apiRequest('/users?role=doctor')
  },

  appointments: {
    getAll: () => apiRequest('/appointments'),
    create: (data) => apiRequest('/appointments', {
      method: 'POST',
      body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
    }),
    getByPatient: (patientId) => apiRequest(`/appointments?patientId=${patientId}`),
    getByDoctor: (doctorId) => apiRequest(`/appointments?doctorId=${doctorId}`),
    updateStatus: async function (id, status) {
      const appointment = await apiRequest(`/appointments/${id}`);
      const doctor = await apiRequest(`/users/${appointment.doctorId}`);
      const price = doctor.appointmentPrice || 0;
      let salaryUpdate = 0;

      // Financial Logic
      if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'done') {
        // 80% to Doctor, 20% to Admin
        salaryUpdate = price * 0.8;
      } else if (status.toLowerCase() === 'cancelled' && (appointment.status.toLowerCase() === 'confirmed' || appointment.status.toLowerCase() === 'pending')) {
        // Penalty 10% if doctor cancels a confirmed/pending appointment
        salaryUpdate = -(price * 0.1);
      }

      if (salaryUpdate !== 0) {
        await HealthcareStorage.auth.updateUser(doctor.id, {
          salary: (doctor.salary || 0) + salaryUpdate
        });
      }

      return apiRequest(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, updatedAt: new Date().toISOString() })
      });
    }
  },

  medicalRecords: {
    getByPatient: (patientId) => apiRequest(`/medical_records?patientId=${patientId}`),
    create: (data) => apiRequest('/medical_records', {
      method: 'POST',
      body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
    })
  },

  prescriptions: {
    getAll: () => apiRequest('/prescriptions'),
    getByPatient: (patientId) => apiRequest(`/prescriptions?patientId=${patientId}`),
    getByDoctor: (doctorId) => apiRequest(`/prescriptions?doctorId=${doctorId}`),
    create: (data) => apiRequest('/prescriptions', {
      method: 'POST',
      body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
    })
  },

  doctorApplications: {
    getAll: () => apiRequest('/doctor_applications'),
    create: (data) => apiRequest('/doctor_applications', {
      method: 'POST',
      body: JSON.stringify({ ...data, status: 'pending', createdAt: new Date().toISOString() })
    }),
    updateStatus: async function (id, status) {
      const app = await apiRequest(`/doctor_applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      if (status === 'approved') {
        await HealthcareStorage.users.create({
          email: app.email,
          password: app.password,
          role: 'doctor',
          fullname: app.fullname,
          specialty: app.specialty,
          phone: app.phone,
          profileImg: app.profileImg,
          appointmentPrice: app.appointmentPrice || 0,
          experience: app.experience || 0,
          salary: 0
        });
      }
      return app;
    }
  },

  metrics: {
    get: () => apiRequest('/system_metrics'),
    update: (updates) => apiRequest('/system_metrics', {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  },

  // --- UTILS ---
  utils: {
    processImage: function (file, maxWidth = 150, quality = 0.2) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
            else { if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });
    }
  },

  // --- NAVIGATION HELPER ---
  navigate: function (path) {
    const rootPath = window.location.pathname.includes('/html/') ? window.location.pathname.split('/html/')[0] : '';
    // Ensure path starts with / if it doesn't
    const target = path.startsWith('/') ? path : '/' + path;
    window.location.href = rootPath + target;
  },


  // --- AUTH GUARD ---
  guard: async function () {
    // Validate session first (async)
    const user = await this.auth.validateSession();
    const path = window.location.pathname.toLowerCase();
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    const isAdminPage = path.includes('/addmin/');
    const isDoctorPage = path.includes('/doctor/');
    const isPatientPage = path.includes('/patient/');

    this.auth.bindLogout();

    if (user) {
      if (isAuthPage) {
        if (user.role === 'admin') this.navigate('/html/Addmin/AdminDashBoard/AdminDashboard.html');
        else if (user.role === 'doctor') this.navigate('/html/Doctor/doctor-db.html');
        else if (user.role === 'patient') this.navigate('/html/patient/patient.html');
      }
      if (isAdminPage && user.role !== 'admin') this.navigate('/html/Addmin/AdminDashBoard/AdminDashboard.html');
      if (isDoctorPage && user.role !== 'doctor') this.navigate('/html/Doctor/doctor-db.html');
      if (isPatientPage && user.role !== 'patient') this.navigate('/html/patient/patient.html');
    } else {
      if (isAdminPage) this.navigate('/html/Auth/admin-login.html');
      if (isDoctorPage || isPatientPage) this.navigate('/html/Auth/login.html');
    }
  },

  // --- PATIENT SPECIFIC HELPERS (Synchronous wrappers for local data) ---
  // Note: These expect data to already be in-memory or are used for sync logic.
  // For the dashboard, we should actually fetch them properly.
  patient: {
    getAppointments: (patientId) => apiRequest(`/appointments?patientId=${patientId}`),
    getMedicalRecords: (patientId) => apiRequest(`/medical_records?patientId=${patientId}`),
    getPrescriptions: (patientId) => apiRequest(`/prescriptions?patientId=${patientId}`)
  },

  doctor: {
    getAllPatients: () => apiRequest('/users?role=patient'),
    getAppointments: (doctorId) => apiRequest(`/appointments?doctorId=${doctorId}`),
    getPrescriptions: (doctorId) => apiRequest(`/prescriptions?doctorId=${doctorId}`),
    addPrescription: (data) => apiRequest('/prescriptions', {
      method: 'POST',
      body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
    })
  },

  admin: {
    users: {
      getAll: () => apiRequest('/users'),
      delete: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
      create: (userData) => apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ ...userData, status: 'active', createdAt: new Date().toISOString() })
      })
    }
  },
  payment: {
    /**
     * Verify Visa Card
     */
    verifyCard: async function (cardNumber, expiryDate, cvv) {
      try {
        const response = await apiRequest('/visa_cards');
        const card = response.find(c =>
          c.cardNumber === cardNumber.replace(/\s/g, '') &&
          c.expiryDate === expiryDate &&
          c.cvv === cvv
        );
        return card || null;
      } catch (error) {
        console.error('Card verification error:', error);
        return null;
      }
    },

    /**
     * Get Doctor's Appointment Price
     */
    getDoctorPrice: async function (doctorId) {
      try {
        const doctor = await apiRequest(`/users/${doctorId}`);
        return doctor.appointmentPrice || 200; // Default price if not set
      } catch (error) {
        console.error('Price fetch error:', error);
        return 200;
      }
    },
    /**
     * Calculate Booking Fee based on urgency
     * <2h: Not allowed
     * 2-6h: +50% Emergency
     * 6-12h: +30% Very Urgent
     * 12-24h: +20% Urgent
     * 24-36h: +10% Soon
     * >36h: Normal (0%)
     */
    calculateBookingFee: function (appointmentDateTime, basePrice) {
      const now = new Date();
      const appointmentDate = new Date(appointmentDateTime);
      const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);

      console.log('🕒 Booking Fee Calculation:');
      console.log('Now:', now);
      console.log('Appointment:', appointmentDate);
      console.log('Hours until appointment:', hoursUntilAppointment);

      // LESS THAN 2 HOURS: NOT ALLOWED
      if (hoursUntilAppointment < 2) {
        return {
          allowed: false,
          message: '❌ Booking not allowed less than 2 hours before appointment time'
        };
      }
      // 2-6 HOURS: EMERGENCY (+50%)
      else if (hoursUntilAppointment >= 2 && hoursUntilAppointment < 6) {
        const urgencyFee = basePrice * 0.50;
        return {
          allowed: true,
          basePrice: basePrice,
          urgencyFee: urgencyFee,
          totalPrice: basePrice + urgencyFee,
          urgencyPercentage: 50,
          pricingType: 'emergency',
          badge: '🔴 Emergency',
          badgeColor: '#f44336',
          message: `⚠️ Emergency booking: +50% urgency fee (${urgencyFee.toFixed(2)} EGP)`
        };
      }
      // 6-12 HOURS: VERY URGENT (+30%)
      else if (hoursUntilAppointment >= 6 && hoursUntilAppointment < 12) {
        const urgencyFee = basePrice * 0.30;
        return {
          allowed: true,
          basePrice: basePrice,
          urgencyFee: urgencyFee,
          totalPrice: basePrice + urgencyFee,
          urgencyPercentage: 30,
          pricingType: 'very-urgent',
          badge: '🟠 Very Urgent',
          badgeColor: '#ff9800',
          message: `⚠️ Very urgent booking: +30% urgency fee (${urgencyFee.toFixed(2)} EGP)`
        };
      }
      // 12-24 HOURS: URGENT (+20%)
      else if (hoursUntilAppointment >= 12 && hoursUntilAppointment < 24) {
        const urgencyFee = basePrice * 0.20;
        return {
          allowed: true,
          basePrice: basePrice,
          urgencyFee: urgencyFee,
          totalPrice: basePrice + urgencyFee,
          urgencyPercentage: 20,
          pricingType: 'urgent',
          badge: '🟡 Urgent',
          badgeColor: '#ffc107',
          message: `⚠️ Urgent booking: +20% urgency fee (${urgencyFee.toFixed(2)} EGP)`
        };
      }
      // 24-36 HOURS: SOON (+10%)
      else if (hoursUntilAppointment >= 24 && hoursUntilAppointment < 36) {
        const urgencyFee = basePrice * 0.10;
        return {
          allowed: true,
          basePrice: basePrice,
          urgencyFee: urgencyFee,
          totalPrice: basePrice + urgencyFee,
          urgencyPercentage: 10,
          pricingType: 'soon',
          badge: '🟢 Soon',
          badgeColor: '#8bc34a',
          message: `⚠️ Booking soon: +10% urgency fee (${urgencyFee.toFixed(2)} EGP)`
        };
      }
      // MORE THAN 36 HOURS: NORMAL (0%)
      else {
        return {
          allowed: true,
          basePrice: basePrice,
          urgencyFee: 0,
          totalPrice: basePrice,
          urgencyPercentage: 0,
          pricingType: 'normal',
          badge: '✅ Normal',
          badgeColor: '#4caf50',
          message: 'Standard booking at regular price'
        };
      }
    },

    /**
     * Process Payment (ACTUALLY DEDUCT from balance)
     */
    processPayment: async function (cardNumber, amount) {
      try {
        const cards = await apiRequest('/visa_cards');
        const card = cards.find(c => c.cardNumber === cardNumber);

        if (!card) {
          return { success: false, message: 'Card not found' };
        }

        if (card.balance < amount) {
          return { success: false, message: 'Insufficient balance' };
        }

        const newBalance = card.balance - amount;
        await apiRequest(`/visa_cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: newBalance })
        });

        return {
          success: true,
          message: 'Payment successful',
          transactionId: 'TXN' + Date.now(),
          cardId: card.id,
          cardNumber: card.cardNumber,
          amountPaid: amount,
          previousBalance: card.balance,
          newBalance: newBalance
        };
      } catch (error) {
        console.error('Payment processing error:', error);
        return { success: false, message: 'Payment failed' };
      }
    },

    /**
     * Process Refund (Add money back to card)
     */
    processRefund: async function (cardNumber, amount) {
      try {
        const cards = await apiRequest('/visa_cards');
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        const card = cards.find(c => c.cardNumber === cleanCardNumber);

        if (!card) {
          console.error('Card not found for refund. Looking for:', cleanCardNumber);
          return { success: false, message: 'Card not found' };
        }

        console.log('Processing refund:', amount, 'EGP to card:', card.cardNumber);
        console.log('Current balance:', card.balance, 'EGP');

        const newBalance = parseFloat(card.balance) + parseFloat(amount);
        await apiRequest(`/visa_cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: newBalance })
        });

        console.log('New balance after refund:', newBalance, 'EGP');

        return {
          success: true,
          message: 'Refund processed successfully',
          refundAmount: amount,
          previousBalance: card.balance,
          newBalance: newBalance
        };
      } catch (error) {
        console.error('Refund processing error:', error);
        return { success: false, message: 'Refund failed' };
      }
    },

    /**
    * Calculate Cancellation Fee (UPDATED POLICY)
    * >36h = 0% fee (full refund)
    * 24-36h = 10% fee
    * 12-24h = 20% fee
    * 6-12h = 30% fee
    * 2-6h = 50% fee
    * <2h = 100% fee (cannot cancel)
    */
    calculateCancellationFee: function (appointmentDateTime, appointmentPrice) {
      const now = new Date();
      const appointmentDate = new Date(appointmentDateTime);
      const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);

      // LESS THAN 2 HOURS: NOT ALLOWED (100% FEE - CANNOT CANCEL)
      if (hoursUntilAppointment < 2) {
        return {
          allowed: false,
          fee: appointmentPrice,
          refund: 0,
          percentage: 100,
          message: '❌ Cancellation not allowed less than 2 hours before appointment'
        };
      }
      // 2-6 HOURS: 50% FEE
      else if (hoursUntilAppointment >= 2 && hoursUntilAppointment < 6) {
        const fee = appointmentPrice * 0.50;
        return {
          allowed: true,
          fee: fee,
          refund: appointmentPrice - fee,
          percentage: 50,
          message: `⚠️ 50% cancellation fee (${fee.toFixed(2)} EGP). Refund: ${(appointmentPrice - fee).toFixed(2)} EGP`
        };
      }
      // 6-12 HOURS: 30% FEE
      else if (hoursUntilAppointment >= 6 && hoursUntilAppointment < 12) {
        const fee = appointmentPrice * 0.30;
        return {
          allowed: true,
          fee: fee,
          refund: appointmentPrice - fee,
          percentage: 30,
          message: `⚠️ 30% cancellation fee (${fee.toFixed(2)} EGP). Refund: ${(appointmentPrice - fee).toFixed(2)} EGP`
        };
      }
      // 12-24 HOURS: 20% FEE
      else if (hoursUntilAppointment >= 12 && hoursUntilAppointment < 24) {
        const fee = appointmentPrice * 0.20;
        return {
          allowed: true,
          fee: fee,
          refund: appointmentPrice - fee,
          percentage: 20,
          message: `⚠️ 20% cancellation fee (${fee.toFixed(2)} EGP). Refund: ${(appointmentPrice - fee).toFixed(2)} EGP`
        };
      }
      // 24-36 HOURS: 10% FEE
      else if (hoursUntilAppointment >= 24 && hoursUntilAppointment < 36) {
        const fee = appointmentPrice * 0.10;
        return {
          allowed: true,
          fee: fee,
          refund: appointmentPrice - fee,
          percentage: 10,
          message: `✅ 10% cancellation fee (${fee.toFixed(2)} EGP). Refund: ${(appointmentPrice - fee).toFixed(2)} EGP`
        };
      }
      // MORE THAN 36 HOURS: FULL REFUND (0% FEE)
      else {
        return {
          allowed: true,
          fee: 0,
          refund: appointmentPrice,
          percentage: 0,
          message: `✅ Full refund: ${appointmentPrice.toFixed(2)} EGP (no cancellation fee)`
        };
      }
    }
  },


  // --- HOME REDIRECTION ---
  goHome: function () {
    const user = this.auth.getCurrentUser();
    const rootPath = window.location.pathname.includes('/html/') ? window.location.pathname.split('/html/')[0] : '';

    if (user) {
      if (user.role === 'admin') window.location.href = rootPath + '/html/Addmin/AdminDashBoard/AdminDashboard.html';
      else if (user.role === 'doctor') window.location.href = rootPath + '/html/Doctor/doctor-db.html';
      else if (user.role === 'patient') window.location.href = rootPath + '/html/patient/patient.html';
      else window.location.href = rootPath + '/index.html';
    } else {
      window.location.href = rootPath + '/index.html';
    }
  }
};

// --- GLOBAL EVENT BINDING ---
if (typeof window !== 'undefined') {
  window.HealthcareStorage = HealthcareStorage;

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Auth Guard
    window.HealthcareStorage.guard();

    // 2. Bind Smart Home Redirection
    document.addEventListener('click', (e) => {
      const homeLink = e.target.closest('.home-icon, .brand-icon-only, .logo-home, [data-go-home]');
      if (homeLink) {
        e.preventDefault();
        window.HealthcareStorage.goHome();
      }
    });
  });
}
