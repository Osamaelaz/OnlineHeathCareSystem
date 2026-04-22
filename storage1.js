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
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);
    throw error;
  }
}

const HealthcareStorage = {
  // --- SESSION MANAGEMENT (LocalStorage) ---
  auth: {
    login: async function (email, password) {
      try {
        const encodedEmail = encodeURIComponent(email);
        const encodedPassword = encodeURIComponent(password);
        const users = await apiRequest(`/users?email=${encodedEmail}&password=${encodedPassword}`);
        const user = users[0];

        if (!user) throw new Error('Invalid email or password');
        if (user.status !== 'active') throw new Error('Account is ' + user.status);

        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        return user;
      } catch (error) {
        throw error;
      }
    },

    logout: function () {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      const rootPath = window.location.pathname.includes('/html/') ? window.location.pathname.split('/html/')[0] : '';
      window.location.href = rootPath + '/html/Auth/login.html';
    },

    getCurrentUser: function () {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      const user = JSON.parse(data);
      if (!user.profileImg) {
        user.profileImg = user.role === 'admin' ? '/images/admin-profile.png' :
                         user.role === 'doctor' ? '/images/doctor-profile.png' :
                         '/images/patient-profile.png';
      }
      return user;
    },

    getUserByEmail: async function (email) {
      const users = await apiRequest(`/users?email=${encodeURIComponent(email)}`);
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
      document.querySelectorAll(selector).ForEach(el => {
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

  // --- DATA MANAGEMENT ---
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
    getByPatient: (patientId) => apiRequest(`/appointments?patientId=${patientId}`),
    getByDoctor: (doctorId) => apiRequest(`/appointments?doctorId=${doctorId}`),
    getById: async function(id) {
      return apiRequest(`/appointments/${id}`);
    },

    create: async function(data) {
      const patientId = data.patientId;
      const doctorId = data.doctorId;
      const dateTime = data.dateTime;

      if (!patientId || !doctorId || !dateTime) {
        throw new Error('Missing required appointment data (patientId, doctorId, or dateTime).');
      }

      // Prevent same doctor same day
      const existingSameDoctor = await apiRequest(`/appointments?patientId=${patientId}&doctorId=${doctorId}`);
      const sameDaySameDoctor = existingSameDoctor.some(app => {
        const appDate = new Date(app.dateTime).toDateString();
        const newDate = new Date(dateTime).toDateString();
        return appDate === newDate && (!data.rescheduleId || app.id !== data.rescheduleId);
      });

      if (sameDaySameDoctor) {
        throw new Error('You cannot book more than one appointment on the same day with the same doctor.');
      }

      // Prevent exact same time slot
      const allAtSameTime = await apiRequest(`/appointments?dateTime=${dateTime}`);
      const overlapping = allAtSameTime.some(app => 
        app.patientId === patientId && (!data.rescheduleId || app.id !== data.rescheduleId)
      );

      if (overlapping) {
        throw new Error('This time slot is already booked. Please choose another time.');
      }

      const newApp = {
        ...data,
        status: 'confirmed',
        paidAmount: data.basePrice || data.doctorPrice || 0,
        paymentCardNumber: data.paymentCardNumber || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        const response = await apiRequest('/appointments', {
          method: 'POST',
          body: JSON.stringify(newApp)
        });
        return response;
      } catch (error) {
        console.error('Failed to create appointment:', error);
        throw new Error('Failed to save appointment. Please try again.');
      }
    },

    updateStatus: (id, status) => apiRequest(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, updatedAt: new Date().toISOString() })
    }),

    cancel: (id, refundAmount) => apiRequest(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'cancelled',
        refundAmount: refundAmount,
        updatedAt: new Date().toISOString()
      })
    })
  },

prescriptions: {
    getAll: () => apiRequest('/prescriptions'),
    getByPatient: (patientId) => apiRequest(`/prescriptions?patientId=${patientId}`),
    getById: (id) => apiRequest(`/prescriptions/${id}`),  // ← السطر الجديد ده
    create: (data) => apiRequest('/prescriptions', {
        method: 'POST',
        body: JSON.stringify({ ...data, createdAt: new Date().toISOString() })
    })
},

  // --- PAYMENT SYSTEM (النسخة الصحيحة والوحيدة) ---
  payment: {
    verifyCard: async function(cardNumber, expiryDate, cvv) {
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

    getDoctorPrice: async function(doctorId) {
      try {
        const doctor = await apiRequest(`/users/${doctorId}`);
        return doctor.appointmentPrice || 200;
      } catch (error) {
        console.error('Price fetch error:', error);
        return 200;
      }
    },

    calculateBookingFee: function(appointmentDateTime, basePrice) {
      return {
        allowed: true,
        basePrice: basePrice,
        urgencyFee: 0,
        totalPrice: basePrice,
        urgencyPercentage: 0,
        pricingType: 'normal',
        badge: '✅ Standard Price',
        badgeColor: '#4caf50',
        message: 'Standard booking at regular price'
      };
    },

    calculateCancellationFee: function(appointmentDateTime, paidAmount) {
      const now = new Date();
      const appointmentTime = new Date(appointmentDateTime);
      const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

      console.log('⏰ Hours until appointment:', hoursUntilAppointment);

      if (hoursUntilAppointment < 1) {
        const refund = paidAmount * 0.75;
        const fee = paidAmount * 0.25;
        return {
          allowed: true,
          fee: fee,
          refund: refund,
          percentage: 25,
          message: `Cancellation less than 1 hour before appointment: 25% fee (${fee.toFixed(2)} EGP). Refund: ${refund.toFixed(2)} EGP`
        };
      }

      return {
        allowed: true,
        fee: 0,
        refund: paidAmount,
        percentage: 0,
        message: `Full refund: ${paidAmount.toFixed(2)} EGP (no cancellation fee)`
      };
    },

    processPayment: async function(cardNumber, amount) {
      try {
        const cards = await apiRequest('/visa_cards');
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        const card = cards.find(c => c.cardNumber === cleanCardNumber);

        if (!card) return { success: false, message: 'Card not found' };
        if (card.balance < amount) return { success: false, message: 'Insufficient balance' };

        const newBalance = parseFloat(card.balance) - parseFloat(amount);

        await apiRequest(`/visa_cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: newBalance })
        });
return {
    success: true,
    cardNumber: cleanCardNumber,
    message: 'Payment successful',
    amountPaid: amount,
    previousBalance: card.balance, // اختياري، بس مفيد
    newBalance: newBalance
};
      } catch (error) {
        console.error('Payment processing error:', error);
        return { success: false, message: 'Payment failed' };
      }
    },

    processRefund: async function(cardNumber, amount) {
      try {
        const cards = await apiRequest('/visa_cards');
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        const card = cards.find(c => c.cardNumber === cleanCardNumber);

        if (!card) {
          console.error('Card not found for refund. Looking for:', cleanCardNumber);
          return { success: false, message: 'Card not found for refund' };
        }

        const newBalance = parseFloat(card.balance) + parseFloat(amount);

        await apiRequest(`/visa_cards/${card.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: newBalance })
        });

        return {
          success: true,
          message: 'Refund processed successfully',
          refundAmount: amount,
          newBalance: newBalance
        };
      } catch (error) {
        console.error('Refund processing error:', error);
        return { success: false, message: 'Refund failed' };
      }
    }
  },

  // --- NAVIGATION & GUARD ---
  navigate: function (path) {
    const rootPath = window.location.pathname.includes('/html/') ? window.location.pathname.split('/html/')[0] : '';
    const target = path.startsWith('/') ? path : '/' + path;
    window.location.href = rootPath + target;
  },

  guard: function () {
    const user = this.auth.getCurrentUser();
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
    } else {
      if (!isAuthPage) this.navigate('/html/Auth/login.html');
    }
  },

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

// --- GLOBAL SETUP ---
if (typeof window !== 'undefined') {
  window.HealthcareStorage = HealthcareStorage;

  document.addEventListener('DOMContentLoaded', () => {
    HealthcareStorage.guard();

    document.addEventListener('click', (e) => {
      const homeLink = e.target.closest('.home-icon, .brand-icon-only, .logo-home, [data-go-home]');
      if (homeLink) {
        e.preventDefault();
        HealthcareStorage.goHome();
      }
    });
  });
}