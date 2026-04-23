# SkillStack Pro — Setup & Run Guide

## What's Included

```
skillstack_pro/
├── index.html          ← Main frontend (single-page app)
├── styles.css          ← All styles
├── script.js           ← All frontend logic
├── config/
│   ├── db.php          ← Database connection settings
│   └── cors.php        ← CORS headers
├── api/
│   ├── auth.php        ← Login / Signup
│   ├── courses.php     ← Course listing & enrollment check
│   ├── lessons.php     ← Lesson listing & progress tracking
│   ├── enroll.php      ← Payment & enrollment (₹10 demo)
│   ├── assignments.php ← Assignment CRUD
│   ├── submissions.php ← File submission & grading
│   └── admin.php       ← Admin stats, users, payments
├── sql/
│   └── skillstack_pro.sql  ← Full database schema + seed data
└── uploads/
    ├── submissions/    ← Student uploaded files (auto-created)
    └── templates/      ← Teacher assignment templates (auto-created)
```

---

## Requirements

- **XAMPP** (Windows/Mac) or **WAMP** / **LAMP** / **MAMP**
- PHP 8.0+, MySQL 5.7+ / MariaDB 10.4+
- A modern browser (Chrome, Firefox, Edge)

---

## Step-by-Step Setup

### Step 1 — Install XAMPP
Download from: https://www.apachefriends.org/
Install and open the XAMPP Control Panel.

### Step 2 — Start Apache & MySQL
In the XAMPP Control Panel, click **Start** for both:
- Apache
- MySQL

### Step 3 — Copy Project Files
Copy the `skillstack_pro/` folder into:
- **Windows:** `C:\xampp\htdocs\skillstack_pro\`
- **Mac:** `/Applications/XAMPP/htdocs/skillstack_pro/`

### Step 4 — Create the Database
1. Open your browser and go to: http://localhost/phpmyadmin
2. Click **Import** in the top menu
3. Click **Choose File** and select:
   `skillstack_pro/sql/skillstack_pro.sql`
4. Scroll down and click **Go / Import**
5. You should see "Import has been successfully finished"

### Step 5 — Configure Database (if needed)
Open `skillstack_pro/config/db.php` and verify:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          // Leave blank for XAMPP default
define('DB_NAME', 'skillstack_db');
define('BASE_URL', 'http://localhost/skillstack_pro');
```
If your MySQL has a password, set it in `DB_PASS`.

### Step 6 — Run the App
Open your browser and go to:
```
http://localhost/skillstack_pro/
```

---

## Demo Login Accounts

| Role    | Email                    | Password     |
|---------|--------------------------|--------------|
| Admin   | admin@skillstack.in      | Admin@123    |
| Teacher | teacher@skillstack.in    | Teacher@123  |
| Student | demo@skillstack.in       | demo123      |
| Student | student@skillstack.in    | Student@123  |

> **Tip:** On the login screen, click the role buttons (🛡 Admin / 📚 Teacher / 🎓 Student) to auto-fill credentials.

---

## Features by Role

### 🎓 Student
- Dashboard with enrolled courses & progress stats
- Browse & enroll in courses (₹10 demo price)
- YouTube video lessons — embedded & playable
- Mark lessons complete → progress bar updates
- Submit assignments (file upload)
- View grades & feedback
- Payment history

### 📚 Teacher
- Dashboard with assignment overview
- Create assignments with optional template file
- View all student submissions
- Grade submissions (marks, grade, feedback)

### 🛡 Admin
- Platform stats (users, revenue, enrollments)
- Manage courses (create, activate/deactivate)
- View all users & payments
- View & manage assignments

---

## Payment & UPI

All paid courses are set to **₹10** for demo purposes.

When a student clicks "Enrol Now":
1. A payment modal opens with a **UPI QR code** (scan with GPay, PhonePe, Paytm, BHIM)
2. UPI ID shown: `sharvilt07@oksbi`
3. Student can also enter UPI ID manually or use Card / Net Banking
4. After clicking "Pay ₹10 & Enroll", the system simulates payment success and automatically enrolls the student

> Note: This is a **simulated payment** — no real money is charged. For production, integrate a real payment gateway (Razorpay, PayU, etc.)

---

## YouTube Videos

Lessons include embedded YouTube videos. They play directly in the app using YouTube's embed API. Click any lesson in the sidebar → the video loads in the player. Use "Mark Complete" to record progress.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page | Make sure Apache is running in XAMPP |
| "DB connection failed" | Check MySQL is running; verify db.php credentials |
| Videos not loading | Check internet connection (YouTube embeds require internet) |
| File upload fails | Check `uploads/` folder permissions (chmod 755) |
| Import SQL error | Drop and recreate `skillstack_db` database, then re-import |

---

## Folder Permissions (Linux/Mac)
```bash
chmod 755 skillstack_pro/uploads/submissions/
chmod 755 skillstack_pro/uploads/templates/
```

---

## Production Notes
- Change `DB_PASS` to a strong password
- Remove demo accounts from the SQL seed data
- Set `BASE_URL` to your actual domain
- Integrate a real UPI/payment gateway for live payments
- Enable HTTPS
