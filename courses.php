<?php
ob_start();
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET courses?user_id=X[&enrolled=1][&category=X]
if ($method === 'GET') {
    $uid      = (int)($_GET['user_id']  ?? 0);
    $enrolled = isset($_GET['enrolled']);
    $cat      = $_GET['category'] ?? '';

    if ($enrolled && $uid) {
        $sql = 'SELECT c.*,
                  u.name AS instructor,
                  (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS total_lessons,
                  (SELECT COUNT(*) FROM lesson_progress lp
                   JOIN lessons l2 ON lp.lesson_id=l2.id
                   WHERE l2.course_id=c.id AND lp.user_id=? AND lp.completed=1) AS done_lessons,
                  1 AS is_enrolled
                FROM courses c
                JOIN enrollments e ON e.course_id=c.id AND e.user_id=?
                LEFT JOIN users u ON u.id=c.teacher_id
                WHERE c.is_active=1
                ORDER BY e.enrolled_at DESC';
        $stmt = $db->prepare($sql);
        $stmt->bind_param('ii', $uid, $uid);
    } else {
        $catClause = $cat ? 'AND c.category=?' : '';
        $sql = "SELECT c.*,
                  u.name AS instructor,
                  (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS total_lessons,
                  IF(? > 0, (SELECT COUNT(*) FROM enrollments WHERE user_id=? AND course_id=c.id), 0) AS is_enrolled
                FROM courses c
                LEFT JOIN users u ON u.id=c.teacher_id
                WHERE c.is_active=1 $catClause
                ORDER BY c.id";
        if ($cat) {
            $stmt = $db->prepare($sql);
            $stmt->bind_param('iis', $uid, $uid, $cat);
        } else {
            $stmt = $db->prepare($sql);
            $stmt->bind_param('ii', $uid, $uid);
        }
    }
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$r) {
        $r['id']           = (int)$r['id'];
        $r['total_lessons']= (int)($r['total_lessons'] ?? 0);
        $r['done_lessons'] = (int)($r['done_lessons']  ?? 0);
        $r['is_enrolled']  = (bool)$r['is_enrolled'];
        $r['is_free']      = (bool)$r['is_free'];
        $r['price']        = (float)$r['price'];
        $r['rating']       = (float)$r['rating'];
    }
    jsonResponse(['success'=>true,'courses'=>$rows]);
}

// Admin: GET courses?admin=1  (all courses with teacher info)
// handled above, admin passes user_id=0

jsonError('Method not allowed.', 405);
