<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// POST /api/enroll.php — simulate payment + enroll
// Body: { user_id, course_id, method, upi_id?, txn_ref? }
if ($method === 'POST') {
    $d         = json_decode(file_get_contents('php://input'), true);
    $uid       = (int)($d['user_id']   ?? 0);
    $cid       = (int)($d['course_id'] ?? 0);
    $payMethod = $d['method']  ?? 'upi';
    $txnRef    = $d['txn_ref'] ?? ('SIM-'.strtoupper(bin2hex(random_bytes(5))));

    if (!$uid || !$cid) jsonError('user_id and course_id required.');

    // Check already enrolled
    $s = $db->prepare('SELECT id FROM enrollments WHERE user_id=? AND course_id=?');
    $s->bind_param('ii', $uid, $cid); $s->execute(); $s->store_result();
    if ($s->num_rows) { $s->close(); jsonError('Already enrolled in this course.', 409); }
    $s->close();

    // Get course
    $s = $db->prepare('SELECT price, is_free, title FROM courses WHERE id=? AND is_active=1');
    $s->bind_param('i', $cid); $s->execute();
    $course = $s->get_result()->fetch_assoc(); $s->close();
    if (!$course) jsonError('Course not found.', 404);

    // DEMO: all paid courses cost ₹10 for presentation
    $amount = $course['is_free'] ? 0.00 : 10.00;
    $pm     = $course['is_free'] ? 'free' : $payMethod;

    // Record payment
    $s = $db->prepare('INSERT INTO payments (user_id,course_id,amount,method,txn_id,status) VALUES (?,?,?,?,?,?)');
    $status = 'success'; // simulated
    $s->bind_param('iidsss', $uid, $cid, $amount, $pm, $txnRef, $status);
    $s->execute();
    $payId = $db->insert_id; $s->close();

    // Enroll
    $s = $db->prepare('INSERT IGNORE INTO enrollments (user_id,course_id,payment_id) VALUES (?,?,?)');
    $s->bind_param('iii', $uid, $cid, $payId);
    if ($s->execute()) {
        jsonResponse([
            'success'   => true,
            'message'   => "Enrolled in \"{$course['title']}\" successfully!",
            'txn_id'    => $txnRef,
            'amount'    => $amount,
            'course_id' => $cid
        ]);
    }
    jsonError('Enrollment failed.', 500);
}

// GET /api/enroll.php?user_id=X — payment history
if ($method === 'GET') {
    $uid = (int)($_GET['user_id'] ?? 0);
    if (!$uid) jsonError('user_id required.');
    $sql = 'SELECT p.*, c.title AS course_title FROM payments p
            JOIN courses c ON c.id=p.course_id
            WHERE p.user_id=? ORDER BY p.paid_at DESC';
    $s = $db->prepare($sql); $s->bind_param('i', $uid); $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC); $s->close();
    jsonResponse(['success'=>true,'payments'=>$rows]);
}

jsonError('Method not allowed.', 405);
