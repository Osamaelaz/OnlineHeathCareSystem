// js/Doctor/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    const calendarContainer = document.getElementById('calendar-widget');
    if (!calendarContainer) return;

    const currentUser = HealthcareStorage.auth.getCurrentUser();
    if (!currentUser) return;

    let currentDate = new Date();
    let appointments = [];
    let selectedDate = new Date(); // Track selected date

    // Fetch appointments once or on month change
    async function fetchAppointments() {
        try {
            appointments = await HealthcareStorage.doctor.getAppointments(currentUser.id);
            renderCalendar();
        } catch (error) {
            console.error('Error fetching appointments for calendar:', error);
        }
    }

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Header Structure
        calendarContainer.innerHTML = `
            <div class="calendar-header">
                <h4 id="monthYearText"></h4>
                <div class="calendar-controls">
                    <button class="cal-btn" id="prevMonth"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="cal-btn" id="nextMonth"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="weekdays-grid">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
            <div class="days-grid" id="daysContainer"></div>
        `;

        const monthYearText = document.getElementById('monthYearText');
        const daysContainer = document.getElementById('daysContainer');
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthYearText.innerText = `${monthNames[month]} ${year}`;

        // Get days logic
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        // Render empty cells for previous month
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            daysContainer.appendChild(emptyCell);
        }

        // Render actual days
        for (let date = 1; date <= lastDate; date++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            dayCell.innerText = date;

            const cellDate = new Date(year, month, date);

            // Mark selected
            if (cellDate.toDateString() === selectedDate.toDateString()) {
                dayCell.classList.add('selected');
            }

            // Mark today
            if (date === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCell.classList.add('today');
            }

            // Check if this date has any appointments
            const hasAppointment = appointments.some(appt => {
                const apptDate = new Date(appt.dateTime);
                return apptDate.getFullYear() === year &&
                    apptDate.getMonth() === month &&
                    apptDate.getDate() === date &&
                    appt.status !== 'cancelled';
            });

            if (hasAppointment) {
                dayCell.classList.add('has-event');
            }

            // Day click event
            dayCell.addEventListener('click', () => {
                selectedDate = new Date(year, month, date);
                // Trigger an event for other scripts to listen to
                window.dispatchEvent(new CustomEvent('dateSelected', { detail: { date: selectedDate } }));
                renderCalendar();
            });

            daysContainer.appendChild(dayCell);
        }

        // Add Listeners for controls
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    await fetchAppointments();
});
