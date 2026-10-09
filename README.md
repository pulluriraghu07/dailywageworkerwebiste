# DailyWork – Unified Labor & Contractor Platform

A production-ready full-stack web application connecting daily wage workers with local contractors & employers with end-to-end accessibility, real-time live synchronization, mobile OTP verification, 8 Indian languages, Text-to-Speech (TTS), and Speech-to-Text (STT) mic dictation.

---

## 🌟 Key Features

1. **Gateway Role Selector ("Who are you?")**:
   - Welcome landing screen asking whether the user is a **Worker** or an **Employer / Admin**.
   - Universal language selector (8 languages) active immediately from the gateway.
   - Quick **"Switch Role"** and **"Log Out"** buttons available in the top navbar at all times.

2. **Mobile Phone OTP Verification**:
   - Both Workers and Admins sign in or register with their 10-digit mobile number.
   - Secure 6-digit OTP generation with 10-minute expiry stored in SQLite.
   - **Interactive Incoming SMS Drawer**: Renders a realistic simulated mobile SMS toast with 1-click **"⚡ Auto-Fill Code"** for immediate local and manual testing without third-party SMS gateway delays.
   - 60-second countdown timer with resend capability.

3. **Multilingual Support Across 8 Languages**:
   - 🇬🇧 English (`en`)
   - 🇮🇳 Hindi (`hi` - हिंदी)
   - 🇮🇳 Telugu (`te` - తెలుగు)
   - 🇮🇳 Tamil (`ta` - தமிழ்)
   - 🇮🇳 Kannada (`kn` - ಕನ್ನಡ)
   - 🇮🇳 Urdu (`ur` - اردو)
   - 🇮🇳 Bengali (`bn` - বাংলা)
   - 🇮🇳 Marathi (`mr` - मराठी)
   - All section headers, step labels, input placeholders, trade categories, skill badges, dialogs, review grids, and system notifications dynamically adapt when language is changed.

4. **Speech Accessibility Engine**:
   - **Text-To-Speech (🔊 Speaker Button)**: Located next to form labels, text bars, buttons, and review sections. Pronounces text clearly using native Web Speech Synthesis mapped to regional accents (`hi-IN`, `te-IN`, `ta-IN`, etc.). Includes a top audio speaking banner with a quick "■ Stop Audio" control.
   - **Speech-To-Text (🎤 Mic Button)**: Embedded inside or beside every text input. Workers who cannot type can tap the mic and speak their name, address, wage, or work experience directly.
   - **WebAudio Chime**: Dual-tone synthesized chime alerts users when new notifications arrive or actions complete without external audio files.

5. **Worker Portal & Job Discovery**:
   - **5-Step Accessible Wizard**: Personal Info, Skills & Work Type, Experience & Education, Availability & Travel, and Final Review with terms consent.
   - **"Available Jobs Near You"**: Workers can browse live jobs posted by admins within their 10–15 km radius with daily wage badges, timing, and 1-click **"Apply for This Job"**.

6. **Admin Contractor Portal**:
   - **Dashboard**: Active Job Posts, Workers Registered counter, Active Regions, and a live shift start countdown timer.
   - **Post Job Request (3-Step Wizard)**: Work trade, worker count stepper, skill tier, date, time, duration, wage offer, site address, landmark, and an interactive **Animated Radar Map Visualizer** (5 km, 10 km, 15 km).
   - **Registered Workers Roster**: Search by name or phone with voice dictation, filter by trade and status (Pending / Confirmed), and 1-click **"Confirm Worker"**.
   - **Live Work List (1 hour before work)**: Real-time on-site arrival status, "📱 SMS All Workers" dispatch simulator, and "📥 Print / Save Dispatch PDF" for site supervisors.

7. **Real-time Live Sync & Notifications**:
   - When a worker registers or applies for a job, the Admin Dashboard receives an immediate **audible sound chime**, updates the counter badges, and displays a floating alert toast.
   - When an admin posts a new job, workers instantly see it in their "Available Jobs" feed.

---

## 🚀 Quick Start Instructions

### 1. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 2. Start the Server
```powershell
python app.py
```
Or double-click `run.bat` on Windows.

### 3. Open in Browser
Visit:
```
http://127.0.0.1:5000
```

---

## 🔑 Default Test Credentials

### Admin Login
- **Mobile**: `9876543210`
- **Password**: `admin123`
*(Or log in using mobile OTP with 1-click auto-fill)*

### Worker Demo Account
- **Mobile**: `9876511111` (Raju Sharma - Masonry)
*(Or enter any 10-digit mobile number and verify via OTP to register a new worker profile)*

---

## 🛠️ API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/send-otp` | Generates 6-digit OTP and returns SMS payload |
| `POST` | `/api/auth/verify-otp` | Verifies OTP against SQLite database |
| `POST` | `/api/auth/admin/login` | Authenticates admin by password or OTP |
| `POST` | `/api/auth/admin/register` | Registers new admin with company details |
| `GET` | `/api/workers` | Lists registered workers (query, trade, status) |
| `POST` | `/api/workers` | Registers a new worker & notifies admin |
| `GET` | `/api/jobs` | Lists active job requests with worker counts |
| `POST` | `/api/jobs` | Posts a new job request & notifies nearby workers |
| `POST` | `/api/jobs/<job_id>/apply` | Worker applies for an open job |
| `POST` | `/api/jobs/<job_id>/workers/<worker_id>/confirm` | Admin confirms worker for site |
| `GET` | `/api/notifications` | Polling endpoint for real-time live sync |
| `GET` | `/api/stats` | Aggregated dashboard metrics |
