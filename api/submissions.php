<?php
// ============================================================
//  api/submissions.php
//
//  GET  ?assignment_id=X[&student_id=Y]  — teacher: all subs for an assignment
//                                          student: own submission
//  POST multipart/form-data              — student uploads file
//       fields: student_id, assignment_id, file (binary)
//  PUT  JSON { id, grade, feedback }     — teacher grades a submission
//  GET  ?download=1&id=X                 — download raw file
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: fetch / download ─────────────────────────────────────
if ($method === 'GET') {
    // Download raw file
    if (!empty($_GET['download']) && !empty($_GET['id'])) {
        $id   = (int)$_GET['id'];
        $stmt = $db->prepare('SELECT file_data, file_type, file_name FROM submissions WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row || !$row['file_data']) { http_response_code(404); echo 'File not found'; exit; }
        header('Content-Type: ' . ($row['file_type'] ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . addslashes($row['file_name']) . '"');
        echo $row['file_data'];
        exit;
    }

    $assignment_id = (int)($_GET['assignment_id'] ?? 0);
    $student_id    = (int)($_GET['student_id']    ?? 0);

    if (!$assignment_id) { http_response_code(400); echo json_encode(['error' => 'assignment_id required']); exit; }

    if ($student_id) {
        // Student: own submission
        $stmt = $db->prepare('SELECT id, assignment_id, student_id, file_name, file_type, submitted_at, status, grade, feedback FROM submissions WHERE assignment_id = ? AND student_id = ?');
        $stmt->bind_param('ii', $assignment_id, $student_id);
    } else {
        // Teacher: all submissions for assignment
        $stmt = $db->prepare('
            SELECT s.id, s.assignment_id, s.student_id, u.name AS student_name, s.file_name, s.file_type,
                   s.submitted_at, s.status, s.grade, s.feedback, s.graded_at
            FROM submissions s
            JOIN users u ON u.id = s.student_id
            WHERE s.assignment_id = ?
            ORDER BY s.submitted_at DESC
        ');
        $stmt->bind_param('i', $assignment_id);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $subs = [];
    while ($row = $res->fetch_assoc()) {
        unset($row['file_data']); // never send binary in listing
        $subs[] = $row;
    }
    echo json_encode(['success' => true, 'submissions' => $subs]);
    $stmt->close();
    exit;
}

// ── POST: student uploads submission ─────────────────────────
if ($method === 'POST') {
    $student_id    = (int)($_POST['student_id']    ?? 0);
    $assignment_id = (int)($_POST['assignment_id'] ?? 0);

    if (!$student_id || !$assignment_id) {
        http_response_code(400);
        echo json_encode(['error' => 'student_id and assignment_id required']);
        exit;
    }

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'No valid file received.']);
        exit;
    }

    $file      = $_FILES['file'];
    $file_name = basename($file['name']);
    $file_type = $file['type'];
    $file_data = file_get_contents($file['tmp_name']);

    // 10 MB limit
    if (strlen($file_data) > 10 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large (max 10 MB).']);
        exit;
    }

    $stmt = $db->prepare('
        INSERT INTO submissions (assignment_id, student_id, file_name, file_data, file_type, status)
        VALUES (?, ?, ?, ?, ?, "submitted")
        ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), file_data = VALUES(file_data),
                                 file_type = VALUES(file_type), submitted_at = NOW(), status = "submitted",
                                 grade = NULL, feedback = NULL
    ');
    $stmt->bind_param('iisss', $assignment_id, $student_id, $file_name, $file_data, $file_type);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Submission uploaded.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Upload failed: ' . $db->error]);
    }
    $stmt->close();
    exit;
}

// ── PUT: teacher grades a submission ─────────────────────────
if ($method === 'PUT') {
    $data     = json_decode(file_get_contents('php://input'), true);
    $id       = (int)($data['id']       ?? 0);
    $grade    = trim($data['grade']    ?? '');
    $feedback = trim($data['feedback'] ?? '');
    $graded_by= (int)($data['graded_by'] ?? 0);

    if (!$id || !$grade) {
        http_response_code(400);
        echo json_encode(['error' => 'id and grade required']);
        exit;
    }

    $ts   = date('Y-m-d H:i:s');
    $stmt = $db->prepare('UPDATE submissions SET grade = ?, feedback = ?, status = "graded", graded_by = ?, graded_at = ? WHERE id = ?');
    $stmt->bind_param('ssisi', $grade, $feedback, $graded_by, $ts, $id);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Graded successfully.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Grading failed.']);
    }
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
