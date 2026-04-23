<?php
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET assignments ───────────────────────────────────────────
if ($method === 'GET') {
    $uid    = (int)($_GET['user_id']    ?? 0);
    $tid    = (int)($_GET['teacher_id'] ?? 0);
    $cid    = (int)($_GET['course_id']  ?? 0);
    $admin  = isset($_GET['admin']);

    // Admin / Teacher: all assignments with submission counts
    if ($admin || $tid) {
        $filter = $tid ? 'AND a.teacher_id=?' : '';
        $sql = "SELECT a.*, c.title AS course_title,
                  u.name AS teacher_name,
                  (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id) AS sub_count,
                  (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id AND s.status='graded') AS graded_count
                FROM assignments a
                JOIN courses c ON c.id=a.course_id
                LEFT JOIN users u ON u.id=a.teacher_id
                WHERE 1=1 $filter
                ORDER BY a.due_date ASC";
        $stmt = $tid ? $db->prepare($sql) : $db->prepare($sql);
        if ($tid) { $stmt->bind_param('i', $tid); }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        foreach ($rows as &$r) { $r['id']=(int)$r['id']; $r['sub_count']=(int)$r['sub_count']; $r['graded_count']=(int)$r['graded_count']; }
        jsonResponse(['success'=>true,'assignments'=>$rows]);
    }

    // Student: assignments for enrolled courses (with own submission)
    if ($uid) {
        $catClause = $cid ? 'AND a.course_id=?' : '';
        $sql = "SELECT a.*, c.title AS course_title, c.color,
                  s.id AS sub_id, s.file_name, s.submitted_at,
                  s.status AS sub_status, s.grade, s.marks, s.feedback
                FROM assignments a
                JOIN courses c ON c.id=a.course_id
                JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=?
                LEFT JOIN submissions s ON s.assignment_id=a.id AND s.user_id=?
                WHERE 1=1 $catClause
                ORDER BY a.due_date ASC";
        if ($cid) {
            $stmt = $db->prepare($sql);
            $stmt->bind_param('iii', $uid, $uid, $cid);
        } else {
            $stmt = $db->prepare($sql);
            $stmt->bind_param('ii', $uid, $uid);
        }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        foreach ($rows as &$r) { $r['id']=(int)$r['id']; }
        jsonResponse(['success'=>true,'assignments'=>$rows]);
    }
    jsonError('user_id required.');
}

// ── POST: create assignment (teacher/admin) with optional template ──
if ($method === 'POST') {
    // multipart form for file upload
    $cid   = (int)($_POST['course_id']   ?? 0);
    $tid   = (int)($_POST['teacher_id']  ?? 0);
    $title = trim($_POST['title']        ?? '');
    $desc  = trim($_POST['description']  ?? '');
    $due   = trim($_POST['due_date']     ?? '');
    $marks = (int)($_POST['max_marks']   ?? 100);

    if (!$cid || !$title || !$due) jsonError('course_id, title and due_date required.');

    $tplName = null; $tplPath = null;
    if (isset($_FILES['template']) && $_FILES['template']['error'] === UPLOAD_ERR_OK) {
        $f    = $_FILES['template'];
        $ext  = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        $ok   = ['pdf','doc','docx','txt','zip','xlsx','pptx'];
        if (!in_array($ext, $ok)) jsonError('Template: allowed types are '.implode(', ',$ok));
        $dir  = __DIR__.'/../uploads/templates/';
        if (!is_dir($dir)) mkdir($dir,0755,true);
        $safe = 'tpl_'.$cid.'_'.time().'.'.$ext;
        if (move_uploaded_file($f['tmp_name'], $dir.$safe)) {
            $tplName = $f['name'];
            $tplPath = 'uploads/templates/'.$safe;
        }
    }

    $s = $db->prepare(
        'INSERT INTO assignments (course_id,teacher_id,title,description,template_file,template_name,due_date,max_marks)
         VALUES (?,?,?,?,?,?,?,?)'
    );
    $s->bind_param('iisssssi', $cid, $tid, $title, $desc, $tplPath, $tplName, $due, $marks);
    if ($s->execute()) {
        jsonResponse(['success'=>true,'id'=>$db->insert_id,'message'=>'Assignment created.']);
    }
    jsonError('Could not create assignment.', 500);
}

// ── DELETE: delete assignment (admin/teacher) ──────────────────
if ($method === 'DELETE') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    if (!$id) jsonError('Assignment id required.');
    $s = $db->prepare('DELETE FROM assignments WHERE id=?');
    $s->bind_param('i', $id); $s->execute();
    jsonResponse(['success'=>true,'message'=>'Assignment deleted.']);
}

jsonError('Method not allowed.', 405);
