--  SkillStack LMS Pro — Complete Schema v2
--  3 Roles: student | teacher | admin
--  Demo pricing: ₹10 per course for presentation

DROP DATABASE IF EXISTS skillstack_lms;
CREATE DATABASE skillstack_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE skillstack_lms;

-- ── Users ────────────
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('student','teacher','admin') DEFAULT 'student',
  phone      VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Courses ───────────
CREATE TABLE courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  teacher_id  INT,
  category    VARCHAR(50),
  color       VARCHAR(30) DEFAULT 'indigo',
  level       VARCHAR(30) DEFAULT 'Beginner',
  price       DECIMAL(10,2) DEFAULT 10.00,
  is_free     TINYINT(1) DEFAULT 0,
  rating      DECIMAL(2,1) DEFAULT 0.0,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ── Lessons ─────────
CREATE TABLE lessons (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  module_name VARCHAR(150) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  duration    VARCHAR(10) DEFAULT '0m',
  sort_order  INT DEFAULT 0,
  video_url   VARCHAR(500),
  content     TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Payments ───────────
CREATE TABLE payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  course_id      INT NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  method         ENUM('upi','card','netbanking','free','demo') NOT NULL,
  txn_id         VARCHAR(100),
  status         ENUM('pending','success','failed') DEFAULT 'pending',
  paid_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Enrollments ───────────
CREATE TABLE enrollments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  course_id   INT NOT NULL,
  payment_id  INT,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (user_id, course_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

-- ── Lesson Progress ────────
CREATE TABLE lesson_progress (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  lesson_id  INT NOT NULL,
  completed  TINYINT(1) DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prog (user_id, lesson_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id)  ON DELETE CASCADE
);

-- ── Assignments ──────────
CREATE TABLE assignments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  course_id       INT NOT NULL,
  teacher_id      INT,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  template_file   VARCHAR(500),
  template_name   VARCHAR(255),
  due_date        DATE,
  max_marks       INT DEFAULT 100,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id)   ON DELETE SET NULL
);

-- ── Submissions ─────────
CREATE TABLE submissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  user_id       INT NOT NULL,
  file_name     VARCHAR(255),
  file_path     VARCHAR(500),
  notes         TEXT,
  submitted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  status        ENUM('submitted','graded') DEFAULT 'submitted',
  marks         INT DEFAULT NULL,
  grade         VARCHAR(10) DEFAULT NULL,
  feedback      TEXT,
  graded_at     DATETIME,
  graded_by     INT,
  UNIQUE KEY uq_sub (assignment_id, user_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,
  FOREIGN KEY (graded_by)     REFERENCES users(id)       ON DELETE SET NULL
);


--  SEED DATA

-- ── Demo Accounts ──────────────
-- admin@skillstack.in    → Admin@123
-- teacher@skillstack.in  → Teacher@123
-- student@skillstack.in  → Student@123
-- demo@skillstack.in     → demo123  (pre-enrolled in 2 courses)

INSERT INTO users (name, email, password, role, phone) VALUES
('Platform Admin',    'admin@skillstack.in',
 '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p4zZyiSSb9MXK7DPSm9lPa', 'admin',   '9000000001'),
('Prof. Arjun Mehta', 'teacher@skillstack.in',
 '$2y$10$TKh8H1.PfR1f4P9K2J3K5.ZDfTm9.6DQ0y1XKmPDK3QeYCBpAX3Oy', 'teacher', '9000000002'),
('Demo Student',      'demo@skillstack.in',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', '9000000003'),
('Test Student',      'student@skillstack.in',
 '$2y$10$RIkg5uRxTWXoIpAXDf4be.JxBiUhlRkd4HFPSm0ViuB4WQ9IiYkYy', 'student', '9000000004');

-- ── Courses (all paid at ₹10 demo price) ──────────────────────
INSERT INTO courses (title, description, teacher_id, category, color, level, price, is_free, rating) VALUES
('UI/UX Design Fundamentals',
 'Master user-centred design from scratch. Learn Figma, wireframing, prototyping, and usability testing used by top product teams worldwide.',
 2, 'design', 'blue', 'Beginner', 10.00, 0, 4.9),

('Full-Stack JavaScript',
 'From DOM basics to Node.js and React. Build real production-grade apps with modern tooling, REST APIs, and deployment on cloud platforms.',
 2, 'development', 'indigo', 'Intermediate', 10.00, 0, 4.8),

('Data Analysis with Python',
 'Pandas, NumPy, Matplotlib and beyond. Learn to clean, analyse, and visualise real-world datasets to derive meaningful business insights.',
 2, 'data', 'teal', 'Intermediate', 10.00, 0, 4.7),

('Intro to Machine Learning',
 'Supervised & unsupervised learning, decision trees, SVMs, and neural networks — all hands-on with scikit-learn and real datasets.',
 2, 'ai', 'amber', 'Intermediate', 10.00, 0, 4.8),

('Product Management Essentials',
 'Strategy, roadmaps, user stories, and stakeholder management. Everything you need to ship great products as a PM.',
 2, 'business', 'rose', 'Beginner', 10.00, 0, 4.9),

('Git & GitHub for Beginners',
 'Learn version control from zero. Branching, merging, pull requests, GitHub Actions — become confident with Git in any team.',
 2, 'development', 'emerald', 'Beginner', 0.00, 1, 4.6);

-- ── Lessons: Course 1 - UI/UX ─────────────────────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(1,'Module 1: Foundations','What is UX Design?','14m',1,'https://www.youtube.com/embed/SRec90j6lTY'),
(1,'Module 1: Foundations','Design Thinking Process','18m',2,'https://www.youtube.com/embed/a7sEoEvT8l8'),
(1,'Module 1: Foundations','User Research Methods','22m',3,'https://www.youtube.com/embed/7_sFVYfatXY'),
(1,'Module 2: Wireframing','Sketching & Lo-Fi Wireframes','20m',4,'https://www.youtube.com/embed/iqDFS6lyeW0'),
(1,'Module 2: Wireframing','Figma Basics','35m',5,'https://www.youtube.com/embed/FTFaQWZBqQ8'),
(1,'Module 3: Prototyping','Interactive Prototypes','28m',6,'https://www.youtube.com/embed/lTIeZ2ahEkQ'),
(1,'Module 3: Prototyping','Usability Testing','24m',7,'https://www.youtube.com/embed/0YL0xoSmyZI');

-- ── Lessons: Course 2 - JS ────────────────────────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(2,'Module 1: JS Foundations','Variables & Data Types','12m',1,'https://www.youtube.com/embed/W6NZfCO5SIk'),
(2,'Module 1: JS Foundations','Functions & Scope','18m',2,'https://www.youtube.com/embed/mjZEv_Dg-bk'),
(2,'Module 1: JS Foundations','Arrays & Objects','22m',3,'https://www.youtube.com/embed/oigfaZ5ApsM'),
(2,'Module 2: Async JS','Promises Deep Dive','24m',4,'https://www.youtube.com/embed/DHvZLI7Db8E'),
(2,'Module 2: Async JS','Async/Await','38m',5,'https://www.youtube.com/embed/V_Kr9OSfDeU'),
(2,'Module 3: Node.js','Node.js Basics','20m',6,'https://www.youtube.com/embed/TlB_eWDSMt4'),
(2,'Module 3: Node.js','Express Routing','35m',7,'https://www.youtube.com/embed/L72fhGm1tfE');

-- ── Lessons: Course 3 - Python ────────────────────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(3,'Module 1: Python Basics','Python Crash Course','25m',1,'https://www.youtube.com/embed/kqtD5dpn9C8'),
(3,'Module 2: Pandas','Intro to Pandas','30m',2,'https://www.youtube.com/embed/vmEHCJofslg'),
(3,'Module 2: Pandas','DataFrame Operations','28m',3,'https://www.youtube.com/embed/e60ItwlZTKM'),
(3,'Module 3: Visualisation','Matplotlib Basics','22m',4,'https://www.youtube.com/embed/3Xc3CA655Y4');

-- ── Lessons: Course 4 - ML ────────────────────────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(4,'Module 1: Concepts','What is Machine Learning?','20m',1,'https://www.youtube.com/embed/ukzFI9rgwfU'),
(4,'Module 2: Algorithms','Linear Regression','30m',2,'https://www.youtube.com/embed/4b4MUYve_U8'),
(4,'Module 2: Algorithms','Decision Trees','28m',3,'https://www.youtube.com/embed/7VeUPuFGJHk'),
(4,'Module 3: Neural Nets','Intro to Neural Networks','35m',4,'https://www.youtube.com/embed/aircAruvnKk');

-- ── Lessons: Course 5 - Product Management ───────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(5,'Module 1: PM Basics','What Does a PM Do?','18m',1,'https://www.youtube.com/embed/me9ZqStifEY'),
(5,'Module 1: PM Basics','Product Roadmaps','22m',2,'https://www.youtube.com/embed/CbTkN-0OKrc'),
(5,'Module 2: User Research','Writing User Stories','20m',3,'https://www.youtube.com/embed/apOvF9NVguA'),
(5,'Module 3: Launch','Go-to-Market Strategy','25m',4,'https://www.youtube.com/embed/4CsXOkk7pT4');

-- ── Lessons: Course 6 - Git (free) ───────────────────────────
INSERT INTO lessons (course_id, module_name, title, duration, sort_order, video_url) VALUES
(6,'Module 1: Basics','What is Git?','12m',1,'https://www.youtube.com/embed/2ReR1YJrNom'),
(6,'Module 1: Basics','Git Init & Commits','18m',2,'https://www.youtube.com/embed/HVsySz-h9r4'),
(6,'Module 2: Branching','Branches & Merging','22m',3,'https://www.youtube.com/embed/FyAAIHHClqI'),
(6,'Module 3: GitHub','Push, Pull, Pull Requests','25m',4,'https://www.youtube.com/embed/rgbCcBNZcdQ');

-- ── Assignments ───────────────────────────────────────────────
INSERT INTO assignments (course_id, teacher_id, title, description, due_date, max_marks) VALUES
(1,2,'Wireframe Design Project',
 'Create a wireframe for a mobile e-commerce app with at least 5 screens. Submit as a PDF export from Figma.',
 '2026-05-20', 100),
(1,2,'Usability Test Report',
 'Conduct a usability test on any website (minimum 5 participants). Document your findings and recommendations.',
 '2026-06-05', 100),
(2,2,'JS Array Methods Quiz',
 'Build a JavaScript app using map(), filter(), and reduce() on the provided student dataset. Submit your .js file.',
 '2026-05-15', 50),
(2,2,'Express REST API Build',
 'Build a REST API with Express.js with at least 4 routes (GET, POST, PUT, DELETE).',
 '2026-05-28', 100),
(3,2,'Pandas Data Cleaning Task',
 'Load the CSV dataset, clean it (handle nulls, fix types, remove duplicates), and answer 5 analysis questions. Submit .ipynb file.',
 '2026-05-18', 100),
(4,2,'Linear Regression Project',
 'Implement linear regression from scratch (no sklearn) to predict housing prices. Submit a .py file.',
 '2026-05-25', 100);

-- ── Demo student pre-enrolled in courses 1 & 2 (₹10 each) ───
INSERT INTO payments (user_id, course_id, amount, method, txn_id, status) VALUES
(3, 1, 10.00, 'demo', 'DEMO-TXN-001', 'success'),
(3, 2, 10.00, 'demo', 'DEMO-TXN-002', 'success');

INSERT INTO enrollments (user_id, course_id, payment_id) VALUES
(3, 1, 1),
(3, 2, 2);

-- ── Demo progress for first few lessons ──────────────────────
INSERT INTO lesson_progress (user_id, lesson_id, completed) VALUES
(3, 1, 1),
(3, 2, 1),
(3, 3, 1),
(3, 8, 1),
(3, 9, 1);


--  TESTS MODULE (MCQ with auto-grading)

-- ── Tests ───────────────────────
CREATE TABLE tests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  teacher_id  INT,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  duration_min INT DEFAULT 30,
  max_attempts INT DEFAULT 1,
  pass_percent INT DEFAULT 50,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id)   ON DELETE SET NULL
);

-- ── Questions ──────────────────
CREATE TABLE questions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  test_id      INT NOT NULL,
  question_text TEXT NOT NULL,
  image_path   VARCHAR(500),
  option_a     VARCHAR(500) NOT NULL,
  option_b     VARCHAR(500) NOT NULL,
  option_c     VARCHAR(500) NOT NULL,
  option_d     VARCHAR(500) NOT NULL,
  correct_ans  ENUM('a','b','c','d') NOT NULL,
  marks        INT DEFAULT 1,
  sort_order   INT DEFAULT 0,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- ── Test Attempts ───────────
CREATE TABLE test_attempts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  test_id      INT NOT NULL,
  user_id      INT NOT NULL,
  attempt_no   INT DEFAULT 1,
  score        INT DEFAULT 0,
  total_marks  INT DEFAULT 0,
  percent      DECIMAL(5,2) DEFAULT 0,
  passed       TINYINT(1) DEFAULT 0,
  started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── Test Answers ────────────────
CREATE TABLE test_answers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id   INT NOT NULL,
  question_id  INT NOT NULL,
  chosen_ans   ENUM('a','b','c','d'),
  is_correct   TINYINT(1) DEFAULT 0,
  FOREIGN KEY (attempt_id)  REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id)     ON DELETE CASCADE
);

-- ── Seed: Sample Tests for Course 1 (UI/UX) ──────────────────
INSERT INTO tests (course_id, teacher_id, title, description, duration_min, pass_percent) VALUES
(1, 2, 'UI/UX Fundamentals Quiz', 'Test your understanding of UX design principles.', 30, 50),
(2, 2, 'JavaScript Basics Test', 'MCQ test on JS fundamentals.', 45, 50);

-- ── Seed: Sample Questions (like college LMS style) ───────────
INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_ans, marks, sort_order) VALUES
-- Test 1: UI/UX (modeled on your college LMS question style)
(1, 'Which of the following best describes the primary goal of UX design?',
 'Making the interface visually appealing', 'Ensuring the product is easy and pleasant to use',
 'Writing clean front-end code', 'Reducing the number of features', 'b', 1, 1),
(1, 'In user research, what does a "persona" represent?',
 'A real user interviewed for feedback', 'A fictional character representing a user segment',
 'A prototype of the interface', 'A usability test report', 'b', 1, 2),
(1, 'Which design principle refers to maintaining visual consistency across screens?',
 'Proximity', 'Alignment', 'Repetition', 'Contrast', 'c', 1, 3),
(1, 'What is the correct order in a typical UX design process?',
 'Prototype → Research → Test → Design', 'Research → Define → Ideate → Prototype → Test',
 'Design → Research → Prototype → Define', 'Test → Ideate → Prototype → Research', 'b', 1, 4),
-- Test 2: JavaScript
(2, 'Which keyword declares a block-scoped variable in modern JavaScript?',
 'var', 'let', 'def', 'dim', 'b', 1, 1),
(2, 'What does the === operator check in JavaScript?',
 'Value only', 'Type only', 'Value and type', 'Reference equality', 'c', 1, 2),
(2, 'Which array method creates a new array with elements that pass a condition?',
 'map()', 'reduce()', 'filter()', 'forEach()', 'c', 1, 3),
(2, 'What is the output of: console.log(typeof null)?',
 '"null"', '"undefined"', '"object"', '"boolean"', 'c', 1, 4);


--
UPDATE `users`
SET `password` = '$2y$10$oB3870FhghGArUbbqcf8juBFdCJKE0AoZ/Iu5aIN90Wr66Kf67ZlC'
WHERE `email` = 'admin@skillstack.in';


UPDATE `users`
SET `password` = '$2y$10$8E/oNXDdyhF0diAd1ZPgk.ppYpqkLWeEwUHCAeL58XMbwt2n1lHNO'
WHERE `email` = 'teacher@skillstack.in';


UPDATE `users`
SET `password` = '$2y$10$UP5ujAsKWzS4LwBQqw7nyelXdcvrNy4oKLQDj2P.RT5WyYQNsumkO'
WHERE `email` = 'demo@skillstack.in';
