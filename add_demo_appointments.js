// Script to add demo appointments for video recording
// This will add various appointments with different statuses

async function addDemoAppointments() {
    const API_URL = 'http://localhost:3000';

    try {
        console.log('🎬 Adding demo appointments for video recording...\n');

        // Patient ID (Aziz Mansour)
        const patientId = '0180';

        // Current time
        const now = new Date('2026-01-17T08:55:15+02:00');

        // Define demo appointments with various scenarios
        const demoAppointments = [
            {
                patientId: patientId,
                doctorId: '5h6fLvX', // Dr. Hazem Ibrahim - Pediatrics
                dateTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // +2 days
                time: '10:00 AM',
                readableDate: 'Sunday, January 19',
                reason: 'Regular checkup for asthma follow-up',
                basePrice: 250,
                paidAmount: 250,
                status: 'confirmed',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            },
            {
                patientId: patientId,
                doctorId: 'DOC002', // Dr. Sarah Ahmed - Cardiology
                dateTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // +3 days, 2pm
                time: '2:00 PM',
                readableDate: 'Monday, January 20',
                reason: 'Heart consultation - chest pain',
                basePrice: 350,
                paidAmount: 350,
                status: 'pending',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            },
            {
                patientId: patientId,
                doctorId: '5h6fLvX', // Dr. Hazem Ibrahim
                dateTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // +5 days
                time: '11:30 AM',
                readableDate: 'Wednesday, January 22',
                reason: 'Vaccination appointment',
                basePrice: 250,
                paidAmount: 250,
                status: 'confirmed',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            },
            {
                patientId: patientId,
                doctorId: 'DOC003', // Dr. Khaled Omar - Neurology
                dateTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 days
                time: '9:00 AM',
                readableDate: 'Friday, January 24',
                reason: 'Headache consultation',
                basePrice: 400,
                paidAmount: 400,
                status: 'pending',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            },
            {
                patientId: patientId,
                doctorId: 'DOC004', // Dr. Layla Mahmoud - Dermatology
                dateTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // -5 days (past)
                time: '3:00 PM',
                readableDate: 'Sunday, January 12',
                reason: 'Skin rash examination',
                basePrice: 250,
                paidAmount: 250,
                status: 'completed',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            },
            {
                patientId: patientId,
                doctorId: '5h6fLvX', // Dr. Hazem Ibrahim
                dateTime: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // -10 days (past)
                time: '10:00 AM',
                readableDate: 'Wednesday, January 7',
                reason: 'Previous asthma checkup',
                basePrice: 250,
                paidAmount: 250,
                status: 'completed',
                paymentCardNumber: '4532015112830366',
                pricingType: 'normal'
            }
        ];

        console.log(`📋 Creating ${demoAppointments.length} demo appointments...\n`);

        let successCount = 0;

        for (const appointment of demoAppointments) {
            try {
                const response = await fetch(`${API_URL}/appointments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...appointment,
                        createdAt: new Date().toISOString()
                    })
                });

                if (response.ok) {
                    const created = await response.json();
                    console.log(`✅ Created appointment #${created.id}`);
                    console.log(`   Doctor: ${appointment.doctorId}`);
                    console.log(`   Date: ${appointment.readableDate} at ${appointment.time}`);
                    console.log(`   Status: ${appointment.status}`);
                    console.log(`   Reason: ${appointment.reason}\n`);
                    successCount++;
                } else {
                    console.log(`❌ Failed to create appointment`);
                }
            } catch (error) {
                console.error(`❌ Error creating appointment:`, error.message);
            }
        }

        console.log(`\n🎉 Successfully created ${successCount}/${demoAppointments.length} appointments!`);
        console.log(`\n📝 Summary:`);
        console.log(`   - Patient: Aziz Mansour (ID: ${patientId})`);
        console.log(`   - Main Doctor: Dr. Hazem Ibrahim (ID: 5h6fLvX)`);
        console.log(`   - Appointments: ${successCount} total`);
        console.log(`   - Statuses: Pending, Confirmed, Completed`);
        console.log(`\n✅ Ready for video recording!`);

    } catch (error) {
        console.error('❌ Error adding demo appointments:', error);
    }
}

// Run the script
addDemoAppointments();
