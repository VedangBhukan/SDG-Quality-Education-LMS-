<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// GET /api/submissions.php?assignment_id=X  (teacher/admin)
// GET /api/submissions.php?user_id=X&assignment_id=Y (student check)
if ($method === 'GET') {
    $aid = (int)($_GET['assignment_id'] ?? 0);
    $uid = (int)($_GET['user_id']       ?? 0);
    if (!$aid) jsonError('assignment_id required.');

    if ($uid) {
        // Student: own submission
        $s = $db->prepare('SELECT * FROM submissions WHERE assignment_id=? AND user_id=?');
        $s->bind_param('ii', $aid, $uid); $s->execute();
        $row = $s->get_result()->fetch_assoc(); $s->close();
        jsonResponse(['success'=>true,'submission'=>$row]);
    }

    // Teacher/Admin: all submissions
    $s = $db->prepare(
        'SELECT s.*, u.name AS student_name, u.email AS student_email
         FROM submissions s
         JOIN users u ON u.id=s.user_id
         WHERE s.assignment_id=?
         ORDER BY s.submitted_at DESC'
    );
    $s->bind_param('i', $aid); $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC); $s->close();
    jsonResponse(['success'=>true,'submissions'=>$rows]);
}

// POST /api/submissions.php — submit file (multipart)
if ($method === 'POST' && !isset($_GET['action'])) {
    $uid  = (int)($_POST['user_id']       ?? 0);
    $aid  = (int)($_POST['assignment_id'] ?? 0);
    $notes = trim($_POST['notes']         ?? '');

    if (!$uid || !$aid) jsonError('user_id and assignment_id required.');

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK)
        jsonError('No file uploaded or upload error.');

    $f   = $_FILES['file'];
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    $ok  = ['pdf','doc','docx','zip','py','js','ipynb','txt','png','jpg','jpeg','xlsx','pptx'];
    if (!in_array($ext, $ok)) jsonError('File type not allowed.');
    if ($f['size'] > 25 * 1024 * 1024) jsonError('File too large. Max 25 MB.');

    $dir  = __DIR__.'/../uploads/submissions/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $safe = $uid.'_'.$aid.'_'.time().'.'.$ext;
    if (!move_uploaded_file($f['tmp_name'], $dir.$safe)) jsonError('Could not save file.', 500);

    $fPath = 'uploads/submissions/'.$safe;
    $fName = $f['name'];

    $s = $db->prepare(
        'INSERT INTO submissions (assignment_id,user_id,file_name,file_path,notes)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_path=VALUES(file_path),
         notes=VALUES(notes),submitted_at=NOW(),status="submitted",marks=NULL,grade=NULL,feedback=NULL,graded_at=NULL'
    );
    $s->bind_param('iisss', $aid, $uid, $fName, $fPath, $notes);
    if ($s->execute()) {
        jsonResponse(['success'=>true,'message'=>'Submitted successfully!','file_name'=>$fName]);
    }
    jsonError('DB error: '.$db->error, 500);
}

// PUT /api/submissions.php — grade submission { submission_id, marks, grade, feedback, graded_by }
if ($method === 'PUT') {
    $d   = json_decode(file_get_contents('php://input'), true);
    $sid = (int)($d['submission_id'] ?? 0);
    $marks   = $d['marks']    ?? null;
    $grade   = trim($d['grade']    ?? '');
    $fb      = trim($d['feedback'] ?? '');
    $gby     = (int)($d['graded_by'] ?? 0);
    if (!$sid || !$grade) jsonError('submission_id and grade required.');
    $s = $db->prepare(
        'UPDATE submissions SET marks=?,grade=?,feedback=?,status="graded",graded_at=NOW(),graded_by=? WHERE id=?'
    );
    $s->bind_param('issii', $marks, $grade, $fb, $gby, $sid);
    if ($s->execute()) jsonResponse(['success'=>true,'message'=>'Graded successfully.']);
    jsonError('Could not save grade.', 500);
}

jsonError('Method not allowed.', 405);
