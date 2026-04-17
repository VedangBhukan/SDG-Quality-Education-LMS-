<?php
// ============================================================
//  api/enrollments.php
//  GET  ?user_id=1               — fetch user's enrollments
//  POST { user_id, course_id }   — enroll user in course
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: fetch enrollments (with progress) ───────────────────
if ($method === 'GET') {
    $user_id = (int)($_GET['user_id'] ?? 0);
    if (!$user_id) { http_response_code(400); echo json_encode(['error' => 'user_id required']); exit; }

    $stmt = $db->prepare('
        SELECT
          e.id AS enroll_id,
          c.id AS course_id,
          c.title, c.instructor, c.lessons, c.color, c.category, c.level,
          COUNT(DISTINCT lp.lecture_id) AS completed_lectures,
          COUNT(DISTINCT l.id)          AS total_lectures
        FROM enrollments e
        JOIN courses  c  ON c.id = e.course_id
        LEFT JOIN lectures l  ON l.course_id = c.id
        LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.user_id = e.user_id AND lp.completed = 1
        WHERE e.user_id = ?
        GROUP BY e.id, c.id
        ORDER BY e.enrolled_at DESC
    ');
    $stmt->bind_param('i', $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $enrollments = [];
    while ($row = $res->fetch_assoc()) {
        $total    = (int)$row['total_lectures'];
        $done     = (int)$row['completed_lectures'];
        $pct      = $total > 0 ? round($done / $total * 100) : 0;
        $row['progress_pct']         = $pct;
        $row['completed_lectures']   = $done;
        $row['total_lectures']       = $total;
        $enrollments[] = $row;
    }
    echo json_encode(['success' => true, 'enrollments' => $enrollments]);
    exit;
}

// ── POST: enroll ─────────────────────────────────────────────
if ($method === 'POST') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $user_id   = (int)($data['user_id']   ?? 0);
    $course_id = (int)($data['course_id'] ?? 0);

    if (!$user_id || !$course_id) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id and course_id required']);
        exit;
    }

    // Idempotent insert
    $stmt = $db->prepare('INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)');
    $stmt->bind_param('ii', $user_id, $course_id);
    $stmt->execute();
    echo json_encode(['success' => true, 'message' => 'Enrolled successfully.']);
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
