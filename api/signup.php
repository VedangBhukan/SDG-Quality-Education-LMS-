<?php
// ============================================================
//  api/signup.php  —  POST: Register a new user
//  Body: { "name": "...", "email": "...", "password": "...", "role": "student|teacher" }
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data     = json_decode(file_get_contents('php://input'), true);
$name     = trim($data['name']     ?? '');
$email    = strtolower(trim($data['email']    ?? ''));
$password = $data['password'] ?? '';
// FIXED: accept role from frontend dropdown; default to 'student' if missing/invalid
$role     = in_array($data['role'] ?? '', ['student', 'teacher'], true) ? $data['role'] : 'student';

if (strlen($name) < 2) {
    http_response_code(400);
    echo json_encode(['error' => 'Name must be at least 2 characters.']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address.']);
    exit;
}
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters.']);
    exit;
}

$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['error' => 'An account with this email already exists.']);
    $stmt->close();
    exit;
}
$stmt->close();

$hashed = password_hash($password, PASSWORD_BCRYPT);

// FIXED: INSERT role into users table
$stmt = $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
$stmt->bind_param('ssss', $name, $email, $hashed, $role);

if ($stmt->execute()) {
    $userId = $db->insert_id;
    // FIXED: return role in response so script.js can set up UI immediately after signup
    echo json_encode([
        'success' => true,
        'user'    => [
            'id'    => $userId,
            'name'  => $name,
            'email' => $email,
            'role'  => $role,
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Could not create account. Please try again.']);
}
$stmt->close();
