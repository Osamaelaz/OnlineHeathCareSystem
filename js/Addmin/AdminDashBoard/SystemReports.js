document.addEventListener('DOMContentLoaded', async () => {
    let charts = {};

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

    async function fetchAllData() {
        try {
            const [users, appointments, prescriptions, applications, metrics] = await Promise.all([
                HealthcareStorage.admin.users.getAll(),
                HealthcareStorage.appointments.getAll(),
                HealthcareStorage.prescriptions.getAll().catch(() => []),
                HealthcareStorage.doctorApplications.getAll(),
                HealthcareStorage.metrics.get().catch(() => null)
            ]);

            return { users, appointments, prescriptions, applications, metrics };
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Failed to load data', 'error');
            return null;
        }
    }

    function calculateStatistics(data) {
        const { users, appointments, prescriptions } = data;

        const userStats = {
            total: users.length,
            patients: users.filter(u => u.role === 'patient').length,
            doctors: users.filter(u => u.role === 'doctor').length,
            admins: users.filter(u => u.role === 'admin').length,
            active: users.filter(u => (u.status || 'active') === 'active').length,
            inactive: users.filter(u => (u.status || 'active') !== 'active').length
        };

        const appointmentStats = {
            total: appointments.length,
            confirmed: appointments.filter(a => a.status === 'confirmed').length,
            pending: appointments.filter(a => a.status === 'pending').length,
            completed: appointments.filter(a => a.status === 'completed' || a.status === 'done').length,
            cancelled: appointments.filter(a => a.status === 'cancelled').length
        };

        let totalRevenue = 0;
        const completedAppointments = appointments.filter(a => 
            a.status === 'completed' || a.status === 'done' || a.status === 'confirmed'
        );
        
        completedAppointments.forEach(apt => {
            const doctor = users.find(u => u.id === apt.doctorId && u.role === 'doctor');
            if (doctor && doctor.appointmentPrice) {
                totalRevenue += doctor.appointmentPrice;
            }
        });

        const prescriptionStats = {
            total: prescriptions.length
        };

        const monthlyTrends = calculateMonthlyTrends(appointments);

        const doctorPerformance = calculateDoctorPerformance(users, appointments);

        return {
            userStats,
            appointmentStats,
            prescriptionStats,
            totalRevenue,
            monthlyTrends,
            doctorPerformance
        };
    }

    function calculateMonthlyTrends(appointments) {
        const months = [];
        const counts = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            months.push(monthName);

            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const count = appointments.filter(apt => {
                const aptDate = new Date(apt.dateTime || apt.createdAt);
                return aptDate >= monthStart && aptDate <= monthEnd;
            }).length;

            counts.push(count);
        }

        return { months, counts };
    }

    function calculateDoctorPerformance(users, appointments) {
        const doctors = users.filter(u => u.role === 'doctor' && (u.status || 'active') === 'active');
        
        const performance = doctors.map(doctor => {
            const doctorAppointments = appointments.filter(a => a.doctorId === doctor.id);
            return {
                name: doctor.fullname || 'Unknown',
                count: doctorAppointments.length
            };
        });

        return performance.sort((a, b) => b.count - a.count).slice(0, 10);
    }

    function updateMetrics(stats, data) {
        document.getElementById('totalUsersMetric').textContent = stats.userStats.total;
        document.getElementById('totalAppointmentsMetric').textContent = stats.appointmentStats.total;
        document.getElementById('totalRevenueMetric').textContent = `$${stats.totalRevenue.toLocaleString()}`;
        document.getElementById('totalPrescriptionsMetric').textContent = stats.prescriptionStats.total;

        
    }

    function createUserDistributionChart(stats) {
        const ctx = document.getElementById('userDistributionChart');
        if (!ctx) return;

        if (charts.userDistribution) {
            charts.userDistribution.destroy();
        }

        charts.userDistribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Patients', 'Doctors', 'Admins'],
                datasets: [{
                    data: [stats.userStats.patients, stats.userStats.doctors, stats.userStats.admins],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)'
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(139, 92, 246, 1)',
                        'rgba(245, 158, 11, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    function createAppointmentsStatusChart(stats) {
        const ctx = document.getElementById('appointmentsStatusChart');
        if (!ctx) return;

        if (charts.appointmentsStatus) {
            charts.appointmentsStatus.destroy();
        }

        charts.appointmentsStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Confirmed', 'Pending', 'Completed', 'Cancelled'],
                datasets: [{
                    data: [
                        stats.appointmentStats.confirmed,
                        stats.appointmentStats.pending,
                        stats.appointmentStats.completed,
                        stats.appointmentStats.cancelled
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgba(16, 185, 129, 1)',
                        'rgba(245, 158, 11, 1)',
                        'rgba(59, 130, 246, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    function createMonthlyTrendChart(trends) {
        const ctx = document.getElementById('monthlyTrendChart');
        if (!ctx) return;

        if (charts.monthlyTrend) {
            charts.monthlyTrend.destroy();
        }

        charts.monthlyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trends.months,
                datasets: [{
                    label: 'Appointments',
                    data: trends.counts,
                    borderColor: 'rgba(106, 94, 253, 1)',
                    backgroundColor: 'rgba(106, 94, 253, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: 'rgba(106, 94, 253, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function createDoctorPerformanceChart(performance) {
        const ctx = document.getElementById('doctorPerformanceChart');
        if (!ctx) return;

        if (charts.doctorPerformance) {
            charts.doctorPerformance.destroy();
        }

        const labels = performance.map(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);
        const data = performance.map(d => d.count);

        charts.doctorPerformance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Appointments',
                    data: data,
                    backgroundColor: 'rgba(106, 94, 253, 0.8)',
                    borderColor: 'rgba(106, 94, 253, 1)',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function updateUserStatsTable(stats) {
        const tbody = document.getElementById('userStatsTableBody');
        if (!tbody) return;

        const total = stats.userStats.total;
        const rows = [
            {
                role: 'Patients',
                total: stats.userStats.patients,
                active: stats.userStats.patients,
                inactive: 0,
                percentage: total > 0 ? ((stats.userStats.patients / total) * 100).toFixed(1) : 0
            },
            {
                role: 'Doctors',
                total: stats.userStats.doctors,
                active: stats.userStats.doctors,
                inactive: 0,
                percentage: total > 0 ? ((stats.userStats.doctors / total) * 100).toFixed(1) : 0
            },
            {
                role: 'Admins',
                total: stats.userStats.admins,
                active: stats.userStats.admins,
                inactive: 0,
                percentage: total > 0 ? ((stats.userStats.admins / total) * 100).toFixed(1) : 0
            }
        ];

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><strong>${row.role}</strong></td>
                <td>${row.total}</td>
                <td>${row.active}</td>
                <td>${row.inactive}</td>
                <td>${row.percentage}%</td>
            </tr>
        `).join('');
    }

    function updateAppointmentStatsTable(stats, data) {
        const tbody = document.getElementById('appointmentStatsTableBody');
        if (!tbody) return;

        const total = stats.appointmentStats.total;
        const rows = [
            {
                status: 'Confirmed',
                count: stats.appointmentStats.confirmed,
                percentage: total > 0 ? ((stats.appointmentStats.confirmed / total) * 100).toFixed(1) : 0,
                revenue: calculateStatusRevenue('confirmed', data.appointments, data.users)
            },
            {
                status: 'Pending',
                count: stats.appointmentStats.pending,
                percentage: total > 0 ? ((stats.appointmentStats.pending / total) * 100).toFixed(1) : 0,
                revenue: calculateStatusRevenue('pending', data.appointments, data.users)
            },
            {
                status: 'Completed',
                count: stats.appointmentStats.completed,
                percentage: total > 0 ? ((stats.appointmentStats.completed / total) * 100).toFixed(1) : 0,
                revenue: calculateStatusRevenue('completed', data.appointments, data.users)
            },
            {
                status: 'Cancelled',
                count: stats.appointmentStats.cancelled,
                percentage: total > 0 ? ((stats.appointmentStats.cancelled / total) * 100).toFixed(1) : 0,
                revenue: '$0'
            }
        ];

        tbody.innerHTML = rows.map(row => `
            <tr>
                <td><strong>${row.status}</strong></td>
                <td>${row.count}</td>
                <td>${row.percentage}%</td>
                <td>${row.revenue}</td>
            </tr>
        `).join('');
    }

    function calculateStatusRevenue(status, appointments, users) {
        const statusAppointments = appointments.filter(a => a.status === status);
        let revenue = 0;

        statusAppointments.forEach(apt => {
            const doctor = users.find(u => u.id === apt.doctorId && u.role === 'doctor');
            if (doctor && doctor.appointmentPrice) {
                revenue += doctor.appointmentPrice;
            }
        });

        return `$${revenue.toLocaleString()}`;
    }



    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Export report 
    document.getElementById('exportBtn')?.addEventListener('click', () => {
        showToast('Export functionality coming soon', 'info');
    });

    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        showToast('Refreshing data...', 'info');
        await loadReports();
    });

    async function loadReports() {
        try {
            const data = await fetchAllData();
            if (!data) return;

            const stats = calculateStatistics(data);

            updateMetrics(stats, data);
            updateUserStatsTable(stats);
            updateAppointmentStatsTable(stats, data);

            createUserDistributionChart(stats);
            createAppointmentsStatusChart(stats);
            createMonthlyTrendChart(stats.monthlyTrends);
            createDoctorPerformanceChart(stats.doctorPerformance);

            showToast('Reports loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading reports:', error);
            showToast('Failed to load reports', 'error');
        }
    }

    // Initialize
    updateAdminInfo();
    await loadReports();
});

