-- ============================================================
--  SkillStack LMS v2 — MySQL Schema
--  Run this AFTER dropping or migrating old skillstack_db
-- ============================================================

CREATE DATABASE IF NOT EXISTS skillstack_db;
USE skillstack_db;

-- ── Users (with role: student | teacher) ─────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('student','teacher') DEFAULT 'student',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Courses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  instructor   VARCHAR(100) NOT NULL,
  instructor_id INT DEFAULT NULL,             -- FK to users (teacher)
  lessons      INT DEFAULT 0,
  rating       DECIMAL(2,1) DEFAULT 0.0,
  price        VARCHAR(20),
  category     VARCHAR(50),
  color        VARCHAR(30),
  level        VARCHAR(30),
  description  TEXT
);

-- ── Lectures (videos per course) ─────────────────────────────
CREATE TABLE IF NOT EXISTS lectures (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  module_name VARCHAR(200) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  duration    VARCHAR(20) DEFAULT '0m',       -- e.g. "18m"
  video_url   VARCHAR(500),                   -- YouTube embed or local path
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Enrollments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  course_id   INT NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (user_id, course_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Lecture Progress (per-user, per-lecture) ─────────────────
CREATE TABLE IF NOT EXISTS lecture_progress (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  lecture_id  INT NOT NULL,
  completed   TINYINT(1) DEFAULT 0,
  completed_at DATETIME DEFAULT NULL,
  UNIQUE KEY uq_progress (user_id, lecture_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (lecture_id) REFERENCES lectures(id)  ON DELETE CASCADE
);

-- ── Assignments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  course_id       INT NOT NULL,
  title           VARCHAR(200) NOT NULL,
  course          VARCHAR(200) NOT NULL,
  description     TEXT,
  due_date        DATE,
  created_by      INT DEFAULT NULL,           -- teacher user_id
  FOREIGN KEY (course_id)   REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Submissions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id   INT NOT NULL,
  student_id      INT NOT NULL,
  file_name       VARCHAR(300),               -- original file name
  file_data       LONGBLOB,                   -- binary file content
  file_type       VARCHAR(100),
  submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('submitted','graded') DEFAULT 'submitted',
  grade           VARCHAR(10) DEFAULT NULL,
  feedback        TEXT DEFAULT NULL,
  graded_by       INT DEFAULT NULL,           -- teacher user_id
  graded_at       DATETIME DEFAULT NULL,
  UNIQUE KEY uq_submission (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)    REFERENCES users(id)       ON DELETE CASCADE
);

-- ── Seed: Demo Users ──────────────────────────────────────────
-- student password: demo123
INSERT INTO users (name, email, password, role) VALUES
('Demo Student', 'demo@skillstack.in',    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student'),
('Priya Nair',   'teacher@skillstack.in', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher');

-- ── Seed: Courses ────────────────────────────────────────────
INSERT INTO courses (title, instructor, instructor_id, lessons, rating, price, category, color, level, description) VALUES
('UI/UX Design Fundamentals',    'Sarah Chen',    NULL, 4,  4.9, '₹5,799', 'design',      'blue',    'Beginner',     'Learn the core principles of user-centred design, wireframing, and Figma from scratch.'),
('Full-Stack JavaScript',        'Marco Rossi',   NULL, 8,  4.8, '₹7,499', 'development', 'indigo',  'Intermediate', 'Master modern JavaScript from fundamentals to full-stack apps — Node.js, Express, MongoDB, React.'),
('Data Analysis with Python',    'Priya Nair',    2,    6,  4.7, '₹6,599', 'data',        'teal',    'Intermediate', 'Hands-on Python for data wrangling, visualisation, and statistical analysis with pandas & matplotlib.'),
('Product Management Essentials','Lisa Park',     NULL, 4,  4.9, '₹4,099', 'business',    'rose',    'Beginner',     'Define, launch and iterate on products using frameworks used by top PMs worldwide.'),
('Intro to Machine Learning',    'Dr. Kim',       NULL, 6,  4.8, '₹6,599', 'ai',          'amber',   'Intermediate', 'Understand supervised & unsupervised learning, model evaluation, and scikit-learn in practice.'),
('Growth Marketing Playbook',    'Tom Rivera',    NULL, 4,  4.7, '₹3,299', 'business',    'emerald', 'Beginner',     'SEO, paid ads, email funnels and analytics — everything you need to scale a product.');

-- ── Seed: Lectures (4 per course using YouTube public embeds) ─
INSERT INTO lectures (course_id, module_name, title, duration, video_url, sort_order) VALUES
-- Course 1 – UI/UX
(1,'Module 1: Foundations','What is UX Design?','12m','https://www.youtube.com/embed/v0MsLf5bBdQ',1),
(1,'Module 1: Foundations','User Research Methods','18m','https://www.youtube.com/embed/c1N5LDx3fF0',2),
(1,'Module 2: Tools','Figma Basics','22m','https://www.youtube.com/embed/FTFaQWZBqQ8',3),
(1,'Module 2: Tools','Wireframing & Prototyping','28m','https://www.youtube.com/embed/aBnl6IWaYG0',4),
-- Course 2 – JS
(2,'Module 1: JS Foundations','Variables & Data Types','12m','https://www.youtube.com/embed/W6NZfCO5SIk',1),
(2,'Module 1: JS Foundations','Functions & Scope','18m','https://www.youtube.com/embed/xUI5Tsl2JpY',2),
(2,'Module 2: Async JS','Promises Deep Dive','24m','https://www.youtube.com/embed/DHvZLI7Db8E',3),
(2,'Module 2: Async JS','Async/Await & Fetch','30m','https://www.youtube.com/embed/V_Kr9OSfDeU',4),
(2,'Module 3: Node.js','Intro to Node.js','20m','https://www.youtube.com/embed/ENrzD9HAZK4',5),
(2,'Module 3: Node.js','Express Routing','35m','https://www.youtube.com/embed/L72fhGm1yRo',6),
(2,'Module 4: Database','MongoDB Basics','18m','https://www.youtube.com/embed/c2M-rlkkT5o',7),
(2,'Module 4: Database','REST API Design','45m','https://www.youtube.com/embed/0oXYLzuucwE',8),
-- Course 3 – Python Data
(3,'Module 1: Python Basics','Intro to Python','15m','https://www.youtube.com/embed/kqtD5dpn9C8',1),
(3,'Module 1: Python Basics','Lists & Dictionaries','20m','https://www.youtube.com/embed/W8KRzm-HUcc',2),
(3,'Module 2: pandas','DataFrames with pandas','25m','https://www.youtube.com/embed/vmEHCJofslg',3),
(3,'Module 2: pandas','Data Cleaning','30m','https://www.youtube.com/embed/bDhvCp3_lYw',4),
(3,'Module 3: Visualisation','Matplotlib Charts','18m','https://www.youtube.com/embed/3Xc3CA655Y4',5),
(3,'Module 3: Visualisation','Seaborn & EDA','22m','https://www.youtube.com/embed/6GUZXDef2U0',6),
-- Course 4 – PM
(4,'Module 1: Strategy','Product Thinking','14m','https://www.youtube.com/embed/V5bSqXolnC0',1),
(4,'Module 1: Strategy','Writing PRDs','16m','https://www.youtube.com/embed/h3VUvj5BVAU',2),
(4,'Module 2: Delivery','Roadmapping','20m','https://www.youtube.com/embed/1s2U3uq5bHo',3),
(4,'Module 2: Delivery','Metrics & KPIs','18m','https://www.youtube.com/embed/gFR_ZwV8bBE',4),
-- Course 5 – ML
(5,'Module 1: Concepts','What is ML?','18m','https://www.youtube.com/embed/ukzFI9rgwfU',1),
(5,'Module 1: Concepts','Supervised Learning','22m','https://www.youtube.com/embed/4qVRBYAdLAo',2),
(5,'Module 2: scikit-learn','Linear Regression','25m','https://www.youtube.com/embed/NUXdtN1W1FE',3),
(5,'Module 2: scikit-learn','Classification & Trees','28m','https://www.youtube.com/embed/7eh4d6sabA0',4),
(5,'Module 3: Evaluation','Model Evaluation','20m','https://www.youtube.com/embed/85dtiMz9tSo',5),
(5,'Module 3: Evaluation','Cross-Validation','22m','https://www.youtube.com/embed/fSytzGwwBVw',6),
-- Course 6 – Marketing
(6,'Module 1: Channels','SEO Fundamentals','16m','https://www.youtube.com/embed/hF515-0Tduk',1),
(6,'Module 1: Channels','Google Ads Basics','20m','https://www.youtube.com/embed/B_1JJcFqPeo',2),
(6,'Module 2: Retention','Email Marketing','18m','https://www.youtube.com/embed/ZMtj1BXIIX8',3),
(6,'Module 2: Retention','Analytics & Funnels','22m','https://www.youtube.com/embed/4oY2xbgbcDQ',4);

-- ── Seed: Assignments ────────────────────────────────────────
INSERT INTO assignments (course_id, title, course, description, due_date, created_by) VALUES
(2, 'JS Array Methods Quiz',    'Full-Stack JavaScript',     'Complete all array method exercises in the provided worksheet.',      '2025-07-19', 2),
(1, 'Wireframe Design Project', 'UI/UX Design Fundamentals', 'Design a 3-screen mobile app wireframe using Figma and export PDF.', '2025-07-21', NULL),
(3, 'Pandas DataFrame Task',    'Data Analysis with Python', 'Load, clean and visualise the dataset provided using pandas.',        '2025-07-24', 2),
(2, 'Express REST API Build',   'Full-Stack JavaScript',     'Build a CRUD REST API with Express and test with Postman.',           '2025-07-10', 2),
(1, 'User Research Report',     'UI/UX Design Fundamentals', 'Conduct 3 user interviews and compile a research report.',            '2025-07-05', NULL),
(3, 'NumPy Exercises',          'Data Analysis with Python', 'Solve the NumPy exercise sheet (all 20 questions).',                  '2025-06-28', 2);

-- ── Seed: Demo enrolments for demo student (user 1) ──────────
-- (none — student must enrol themselves)
