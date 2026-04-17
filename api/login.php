<?php
// ============================================================
//  api/login.php  —  POST: Authenticate a user
//  Returns role alongside user info (required by script.js)
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data     = json_decode(file_get_contents('php://input'), true);
$email    = strtolower(trim($data['email']    ?? ''));
$password = $data['password'] ?? '';

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required.']);
    exit;
}

$db   = getDB();
// FIXED: SELECT role as well — script.js needs it to show Teacher Panel
$stmt = $db->prepare('SELECT id, name, email, password, role FROM users WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user   = $result->fetch_assoc();
$stmt->close();

if (!$user || !password_verify($password, $user['password'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect email or password.']);
    exit;
}

// FIXED: return role in response — required for Teacher/Student UI split
echo json_encode([
    'success' => true,
    'user'    => [
        'id'    => (int)$user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],   // 'student' or 'teacher'
    ]
]);
