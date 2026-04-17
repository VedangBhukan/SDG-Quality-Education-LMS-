<?php
// ============================================================
//  api/assignments.php
//
//  GET  ?user_id=X[&status=pending]   — student: own course assignments
//       ?teacher_id=X                 — teacher: all assignments they created
//  POST { title, course_id, course, description, due_date, created_by }
//       — teacher creates a new assignment
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET ──────────────────────────────────────────────────────
if ($method === 'GET') {
    $user_id    = (int)($_GET['user_id']    ?? 0);
    $teacher_id = (int)($_GET['teacher_id'] ?? 0);
    $status     = $_GET['status'] ?? 'all';

    if ($user_id) {
        // FIXED: Student view — joins enrollments so student only sees assignments
        // for courses they are enrolled in, plus their submission status
        $sql = '
            SELECT
              a.id, a.course_id, a.title, a.course, a.description, a.due_date,
              s.id          AS submission_id,
              s.status      AS status,
              s.grade       AS grade,
              s.file_name   AS submitted_file,
              s.submitted_at,
              s.feedback
            FROM assignments a
            JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = ?
            LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
            ORDER BY a.due_date ASC
        ';
        $stmt = $db->prepare($sql);
        $stmt->bind_param('ii', $user_id, $user_id);

    } elseif ($teacher_id) {
        // FIXED: Teacher view — only assignments this teacher created
        $stmt = $db->prepare('SELECT * FROM assignments WHERE created_by = ? ORDER BY due_date DESC');
        $stmt->bind_param('i', $teacher_id);

    } else {
        // Fallback: return all (admin / unfiltered)
        $result = $db->query('SELECT * FROM assignments ORDER BY due_date ASC');
        $rows   = [];
        while ($r = $result->fetch_assoc()) $rows[] = $r;
        echo json_encode(['success' => true, 'assignments' => $rows]);
        exit;
    }

    $stmt->execute();
    $res         = $stmt->get_result();
    $assignments = [];

    while ($row = $res->fetch_assoc()) {
        // Normalize: student with no submission → status = 'pending'
        if ($user_id && $row['submission_id'] === null) {
            $row['status'] = 'pending';
        }
        $row['id']        = (int)$row['id'];
        $row['course_id'] = (int)$row['course_id'];
        $assignments[]    = $row;
    }

    // Optional client-side status filter (pending / submitted / graded)
    if ($status && $status !== 'all') {
        $assignments = array_values(
            array_filter($assignments, fn($a) => $a['status'] === $status)
        );
    }

    echo json_encode(['success' => true, 'assignments' => $assignments]);
    $stmt->close();
    exit;
}

// ── POST: teacher creates assignment ─────────────────────────
if ($method === 'POST') {
    $data       = json_decode(file_get_contents('php://input'), true);
    $title      = trim($data['title']       ?? '');
    $course_id  = (int)($data['course_id']  ?? 0);
    $course     = trim($data['course']      ?? '');
    $desc       = trim($data['description'] ?? '');
    $due_date   = $data['due_date']          ?? '';
    $created_by = (int)($data['created_by'] ?? 0);

    if (!$title || !$course_id || !$due_date) {
        http_response_code(400);
        echo json_encode(['error' => 'title, course_id and due_date are required.']);
        exit;
    }

    $stmt = $db->prepare(
        'INSERT INTO assignments (course_id, title, course, description, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('issssi', $course_id, $title, $course, $desc, $due_date, $created_by);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'id' => $db->insert_id]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Insert failed.']);
    }
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
