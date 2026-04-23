<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$db     = getDB();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// GET stats
if ($action === 'stats' && $method === 'GET') {
    $stats = [];
    $stats['total_users']    = $db->query("SELECT COUNT(*) c FROM users WHERE role='student'")->fetch_assoc()['c'];
    $stats['total_teachers'] = $db->query("SELECT COUNT(*) c FROM users WHERE role='teacher'")->fetch_assoc()['c'];
    $stats['total_courses']  = $db->query("SELECT COUNT(*) c FROM courses WHERE is_active=1")->fetch_assoc()['c'];
    $stats['total_enrolls']  = $db->query("SELECT COUNT(*) c FROM enrollments")->fetch_assoc()['c'];
    $stats['total_revenue']  = $db->query("SELECT IFNULL(SUM(amount),0) r FROM payments WHERE status='success'")->fetch_assoc()['r'];
    $stats['total_subs']     = $db->query("SELECT COUNT(*) c FROM submissions")->fetch_assoc()['c'];
    $stats['pending_grades'] = $db->query("SELECT COUNT(*) c FROM submissions WHERE status='submitted'")->fetch_assoc()['c'];
    jsonResponse(['success'=>true,'stats'=>$stats]);
}

// GET users list
if ($action === 'users' && $method === 'GET') {
    $role = $_GET['role'] ?? '';
    $sql  = "SELECT id,name,email,role,phone,created_at,
               (SELECT COUNT(*) FROM enrollments WHERE user_id=users.id) AS enrollments
             FROM users WHERE 1=1 ".($role ? "AND role='$role'" : "")." ORDER BY created_at DESC";
    $rows = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    jsonResponse(['success'=>true,'users'=>$rows]);
}

// GET payments
if ($action === 'payments' && $method === 'GET') {
    $sql = 'SELECT p.*, u.name AS student_name, u.email AS student_email, c.title AS course_title
            FROM payments p
            JOIN users u ON u.id=p.user_id
            JOIN courses c ON c.id=p.course_id
            ORDER BY p.paid_at DESC LIMIT 100';
    $rows = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    jsonResponse(['success'=>true,'payments'=>$rows]);
}

// POST create course
if ($action === 'create_course' && $method === 'POST') {
    $d     = json_decode(file_get_contents('php://input'), true);
    $title = trim($d['title']       ?? '');
    $desc  = trim($d['description'] ?? '');
    $tid   = (int)($d['teacher_id'] ?? 0);
    $cat   = trim($d['category']    ?? 'development');
    $color = trim($d['color']       ?? 'indigo');
    $level = trim($d['level']       ?? 'Beginner');
    $price = (float)($d['price']    ?? 0);
    $free  = $price == 0 ? 1 : 0;

    if (!$title) jsonError('Title required.');
    $s = $db->prepare(
        'INSERT INTO courses (title,description,teacher_id,category,color,level,price,is_free) VALUES (?,?,?,?,?,?,?,?)'
    );
    $s->bind_param('ssisssdi', $title, $desc, $tid, $cat, $color, $level, $price, $free);
    if ($s->execute()) jsonResponse(['success'=>true,'id'=>$db->insert_id,'message'=>'Course created.']);
    jsonError('Could not create course.', 500);
}

// PUT toggle course active
if ($action === 'toggle_course' && $method === 'PUT') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    if (!$id) jsonError('id required.');
    $db->query("UPDATE courses SET is_active = NOT is_active WHERE id=$id");
    jsonResponse(['success'=>true]);
}

// DELETE user
if ($action === 'delete_user' && $method === 'DELETE') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    if (!$id) jsonError('id required.');
    $db->query("DELETE FROM users WHERE id=$id AND role!='admin'");
    jsonResponse(['success'=>true,'message'=>'User deleted.']);
}

// GET recent_activity
if ($action === 'activity' && $method === 'GET') {
    $sql = "(SELECT 'enrollment' AS type, u.name, c.title AS detail, e.enrolled_at AS at
             FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
             ORDER BY e.enrolled_at DESC LIMIT 5)
            UNION
            (SELECT 'submission' AS type, u.name, a.title AS detail, s.submitted_at AS at
             FROM submissions s JOIN users u ON u.id=s.user_id JOIN assignments a ON a.id=s.assignment_id
             ORDER BY s.submitted_at DESC LIMIT 5)
            ORDER BY at DESC LIMIT 10";
    $rows = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    jsonResponse(['success'=>true,'activity'=>$rows]);
}

jsonError('Invalid action.', 400);
