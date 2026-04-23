<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$action = $_GET['action'] ?? '';

// ── POST /api/auth.php?action=login ───────────────
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $d     = json_decode(file_get_contents('php://input'), true);
    $email = strtolower(trim($d['email'] ?? ''));
    $pass  = $d['password'] ?? '';

    if (!$email || !$pass) jsonError('Email and password required.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id,name,email,password,role,phone FROM users WHERE email=?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $u = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$u || !password_verify($pass, $u['password'])) jsonError('Incorrect email or password.', 401);

    unset($u['password']);
    jsonResponse(['success'=>true,'user'=>$u]);
}

// ── POST /api/auth.php?action=signup ─────────────
if ($action === 'signup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $d     = json_decode(file_get_contents('php://input'), true);
    $name  = trim($d['name']  ?? '');
    $email = strtolower(trim($d['email'] ?? ''));
    $pass  = $d['password'] ?? '';
    $role  = in_array($d['role']??'', ['student','teacher']) ? $d['role'] : 'student';
    $phone = trim($d['phone'] ?? '');

    if (strlen($name)  < 2)                         jsonError('Name must be at least 2 characters.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))  jsonError('Invalid email address.');
    if (strlen($pass)  < 6)                         jsonError('Password must be at least 6 characters.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE email=?');
    $stmt->bind_param('s', $email); $stmt->execute(); $stmt->store_result();
    if ($stmt->num_rows) { $stmt->close(); jsonError('Email already registered.', 409); }
    $stmt->close();

    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $stmt = $db->prepare('INSERT INTO users (name,email,password,role,phone) VALUES (?,?,?,?,?)');
    $stmt->bind_param('sssss', $name, $email, $hash, $role, $phone);
    if ($stmt->execute()) {
        $uid = $db->insert_id;
        jsonResponse(['success'=>true,'user'=>['id'=>$uid,'name'=>$name,'email'=>$email,'role'=>$role,'phone'=>$phone]]);
    }
    jsonError('Could not create account. Try again.', 500);
}

jsonError('Invalid request.', 405);
