<?php
// ============================================================
//  api/lectures.php
//  GET  ?course_id=1&user_id=1   — fetch lectures with progress
//  POST { user_id, lecture_id, completed }  — mark complete
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: list lectures with per-user completion ───────────────
if ($method === 'GET') {
    $course_id = (int)($_GET['course_id'] ?? 0);
    $user_id   = (int)($_GET['user_id']   ?? 0);

    if (!$course_id) { http_response_code(400); echo json_encode(['error' => 'course_id required']); exit; }

    if ($user_id) {
        $stmt = $db->prepare('
            SELECT l.*, COALESCE(lp.completed, 0) AS completed
            FROM lectures l
            LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.user_id = ?
            WHERE l.course_id = ?
            ORDER BY l.sort_order ASC
        ');
        $stmt->bind_param('ii', $user_id, $course_id);
    } else {
        $stmt = $db->prepare('SELECT *, 0 AS completed FROM lectures WHERE course_id = ? ORDER BY sort_order ASC');
        $stmt->bind_param('i', $course_id);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $lectures = [];
    while ($row = $res->fetch_assoc()) {
        $row['id']        = (int)$row['id'];
        $row['course_id'] = (int)$row['course_id'];
        $row['completed'] = (int)$row['completed'];
        $lectures[] = $row;
    }
    echo json_encode(['success' => true, 'lectures' => $lectures]);
    exit;
}

// ── POST: mark lecture complete/incomplete ────────────────────
if ($method === 'POST') {
    $data       = json_decode(file_get_contents('php://input'), true);
    $user_id    = (int)($data['user_id']    ?? 0);
    $lecture_id = (int)($data['lecture_id'] ?? 0);
    $completed  = (int)($data['completed']  ?? 1);  // 1 = done, 0 = undone

    if (!$user_id || !$lecture_id) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id and lecture_id required']);
        exit;
    }

    $ts = $completed ? date('Y-m-d H:i:s') : null;

    $stmt = $db->prepare('
        INSERT INTO lecture_progress (user_id, lecture_id, completed, completed_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE completed = VALUES(completed), completed_at = VALUES(completed_at)
    ');
    $stmt->bind_param('iiis', $user_id, $lecture_id, $completed, $ts);
    $stmt->execute();
    echo json_encode(['success' => true, 'message' => 'Progress saved.']);
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
