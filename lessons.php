<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET lessons?course_id=X&user_id=Y
if ($method === 'GET') {
    $cid = (int)($_GET['course_id'] ?? 0);
    $uid = (int)($_GET['user_id']   ?? 0);
    if (!$cid) jsonError('course_id required.');
    $s = $db->prepare(
        'SELECT l.*, IFNULL(lp.completed,0) AS completed
         FROM lessons l
         LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=?
         WHERE l.course_id=? ORDER BY l.sort_order'
    );
    $s->bind_param('ii', $uid, $cid); $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC); $s->close();
    foreach ($rows as &$r) { $r['id']=(int)$r['id']; $r['completed']=(bool)$r['completed']; }
    jsonResponse(['success'=>true,'lessons'=>$rows]);
}

// POST lessons — mark complete { user_id, lesson_id, completed }
if ($method === 'POST') {
    $d         = json_decode(file_get_contents('php://input'), true);
    $uid       = (int)($d['user_id']   ?? 0);
    $lid       = (int)($d['lesson_id'] ?? 0);
    $completed = (int)(bool)($d['completed'] ?? true);
    if (!$uid || !$lid) jsonError('user_id and lesson_id required.');
    $s = $db->prepare(
        'INSERT INTO lesson_progress (user_id,lesson_id,completed) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE completed=VALUES(completed)'
    );
    $s->bind_param('iii', $uid, $lid, $completed);
    $s->execute(); $s->close();
    jsonResponse(['success'=>true]);
}

jsonError('Method not allowed.', 405);
