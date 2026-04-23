<?php
ob_start();
require_once __DIR__.'/../config/cors.php';
require_once __DIR__.'/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db     = getDB();

/* ────────────────────────────────────────────────────────────
   GET /api/tests.php?action=list&course_id=X&user_id=Y
   Returns all tests for a course with attempt info for user
──────────────────────────────────────────────────────────── */
if ($method === 'GET' && $action === 'list') {
    $cid = (int)($_GET['course_id'] ?? 0);
    $uid = (int)($_GET['user_id']   ?? 0);
    if (!$cid) jsonError('course_id required.');

    $sql = "SELECT t.*,
              u.name AS teacher_name,
              (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) AS total_questions,
              (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id=t.id AND ta.user_id=?) AS attempts_taken,
              (SELECT MAX(ta2.percent) FROM test_attempts ta2 WHERE ta2.test_id=t.id AND ta2.user_id=? AND ta2.submitted_at IS NOT NULL) AS best_score
            FROM tests t
            LEFT JOIN users u ON u.id=t.teacher_id
            WHERE t.course_id=? AND t.is_active=1
            ORDER BY t.created_at DESC";
    $s = $db->prepare($sql);
    $s->bind_param('iii', $uid, $uid, $cid);
    $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$r) {
        $r['id']              = (int)$r['id'];
        $r['total_questions'] = (int)$r['total_questions'];
        $r['attempts_taken']  = (int)$r['attempts_taken'];
        $r['best_score']      = $r['best_score'] !== null ? (float)$r['best_score'] : null;
    }
    jsonResponse(['success'=>true,'tests'=>$rows]);
}

/* ────────────────────────────────────────────────────────────
   GET /api/tests.php?action=teacher&teacher_id=X
   All tests created by teacher
──────────────────────────────────────────────────────────── */
if ($method === 'GET' && $action === 'teacher') {
    $tid = (int)($_GET['teacher_id'] ?? 0);
    if (!$tid) jsonError('teacher_id required.');
    $sql = "SELECT t.*, c.title AS course_title,
              (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) AS total_questions,
              (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id=t.id AND ta.submitted_at IS NOT NULL) AS total_attempts
            FROM tests t
            JOIN courses c ON c.id=t.course_id
            WHERE t.teacher_id=?
            ORDER BY t.created_at DESC";
    $s = $db->prepare($sql);
    $s->bind_param('i', $tid);
    $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$r) {
        $r['total_questions'] = (int)$r['total_questions'];
        $r['total_attempts']  = (int)$r['total_attempts'];
    }
    jsonResponse(['success'=>true,'tests'=>$rows]);
}

/* ────────────────────────────────────────────────────────────
   GET /api/tests.php?action=questions&test_id=X
   Returns questions (without correct_ans for students)
──────────────────────────────────────────────────────────── */
if ($method === 'GET' && $action === 'questions') {
    $tid  = (int)($_GET['test_id'] ?? 0);
    $role = $_GET['role'] ?? 'student';
    if (!$tid) jsonError('test_id required.');

    $sql = "SELECT id, question_text, image_path, option_a, option_b, option_c, option_d, marks, sort_order"
         . ($role === 'teacher' || $role === 'admin' ? ", correct_ans" : "")
         . " FROM questions WHERE test_id=? ORDER BY sort_order, id";
    $s = $db->prepare($sql);
    $s->bind_param('i', $tid);
    $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$r) { $r['id'] = (int)$r['id']; }
    jsonResponse(['success'=>true,'questions'=>$rows]);
}

/* ────────────────────────────────────────────────────────────
   GET /api/tests.php?action=results&test_id=X&user_id=Y
   Student's attempt results with answers
──────────────────────────────────────────────────────────── */
if ($method === 'GET' && $action === 'results') {
    $tid = (int)($_GET['test_id'] ?? 0);
    $uid = (int)($_GET['user_id'] ?? 0);
    if (!$tid || !$uid) jsonError('test_id and user_id required.');

    $s = $db->prepare("SELECT * FROM test_attempts WHERE test_id=? AND user_id=? AND submitted_at IS NOT NULL ORDER BY attempt_no DESC LIMIT 1");
    $s->bind_param('ii', $tid, $uid);
    $s->execute();
    $attempt = $s->get_result()->fetch_assoc();
    if (!$attempt) jsonResponse(['success'=>true,'attempt'=>null]);

    $s2 = $db->prepare(
        "SELECT ta.*, q.question_text, q.image_path, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_ans, q.marks
         FROM test_answers ta
         JOIN questions q ON q.id=ta.question_id
         WHERE ta.attempt_id=?
         ORDER BY q.sort_order, q.id"
    );
    $s2->bind_param('i', $attempt['id']);
    $s2->execute();
    $answers = $s2->get_result()->fetch_all(MYSQLI_ASSOC);
    foreach ($answers as &$a) { $a['is_correct'] = (bool)$a['is_correct']; }
    $attempt['answers'] = $answers;
    jsonResponse(['success'=>true,'attempt'=>$attempt]);
}

/* ────────────────────────────────────────────────────────────
   GET /api/tests.php?action=all_results&test_id=X  (teacher)
──────────────────────────────────────────────────────────── */
if ($method === 'GET' && $action === 'all_results') {
    $tid = (int)($_GET['test_id'] ?? 0);
    if (!$tid) jsonError('test_id required.');
    $sql = "SELECT ta.*, u.name AS student_name, u.email AS student_email
            FROM test_attempts ta
            JOIN users u ON u.id=ta.user_id
            WHERE ta.test_id=? AND ta.submitted_at IS NOT NULL
            ORDER BY ta.submitted_at DESC";
    $s = $db->prepare($sql);
    $s->bind_param('i', $tid);
    $s->execute();
    $rows = $s->get_result()->fetch_all(MYSQLI_ASSOC);
    jsonResponse(['success'=>true,'results'=>$rows]);
}

/* ────────────────────────────────────────────────────────────
   POST /api/tests.php?action=create_test
   Teacher creates a test
──────────────────────────────────────────────────────────── */
if ($method === 'POST' && $action === 'create_test') {
    $d    = json_decode(file_get_contents('php://input'), true);
    $cid  = (int)($d['course_id']    ?? 0);
    $tid  = (int)($d['teacher_id']   ?? 0);
    $title= trim($d['title']         ?? '');
    $desc = trim($d['description']   ?? '');
    $dur  = (int)($d['duration_min'] ?? 30);
    $pass = (int)($d['pass_percent'] ?? 50);
    $max  = (int)($d['max_attempts'] ?? 1);

    if (!$cid || !$title) jsonError('course_id and title required.');

    $s = $db->prepare('INSERT INTO tests (course_id,teacher_id,title,description,duration_min,pass_percent,max_attempts) VALUES (?,?,?,?,?,?,?)');
    $s->bind_param('iissiii', $cid, $tid, $title, $desc, $dur, $pass, $max);
    if ($s->execute()) jsonResponse(['success'=>true,'test_id'=>$db->insert_id,'message'=>'Test created.']);
    jsonError('Could not create test.', 500);
}

/* ────────────────────────────────────────────────────────────
   POST /api/tests.php?action=add_question  (multipart for image)
──────────────────────────────────────────────────────────── */
if ($method === 'POST' && $action === 'add_question') {
    $tid   = (int)($_POST['test_id']   ?? 0);
    $qtext = trim($_POST['question_text'] ?? '');
    $oa    = trim($_POST['option_a']   ?? '');
    $ob    = trim($_POST['option_b']   ?? '');
    $oc    = trim($_POST['option_c']   ?? '');
    $od    = trim($_POST['option_d']   ?? '');
    $ans   = strtolower(trim($_POST['correct_ans'] ?? ''));
    $marks = (int)($_POST['marks']     ?? 1);
    $order = (int)($_POST['sort_order']?? 0);

    if (!$tid || !$qtext || !$oa || !$ob || !$oc || !$od || !in_array($ans,['a','b','c','d']))
        jsonError('All fields required and correct_ans must be a/b/c/d.');

    $imgPath = null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $f   = $_FILES['image'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) jsonError('Image must be jpg/png/gif/webp.');
        if ($f['size'] > 5 * 1024 * 1024) jsonError('Image too large. Max 5 MB.');
        $dir = __DIR__.'/../uploads/questions/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $safe = 'q_'.$tid.'_'.time().'.'.$ext;
        if (move_uploaded_file($f['tmp_name'], $dir.$safe)) {
            $imgPath = 'uploads/questions/'.$safe;
        }
    }

    $s = $db->prepare('INSERT INTO questions (test_id,question_text,image_path,option_a,option_b,option_c,option_d,correct_ans,marks,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $s->bind_param('isssssssii', $tid, $qtext, $imgPath, $oa, $ob, $oc, $od, $ans, $marks, $order);
    if ($s->execute()) jsonResponse(['success'=>true,'question_id'=>$db->insert_id,'message'=>'Question added.']);
    jsonError('Could not add question.', 500);
}

/* ────────────────────────────────────────────────────────────
   DELETE /api/tests.php?action=delete_question
──────────────────────────────────────────────────────────── */
if ($method === 'DELETE' && $action === 'delete_question') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    if (!$id) jsonError('id required.');
    $s = $db->prepare('DELETE FROM questions WHERE id=?');
    $s->bind_param('i', $id);
    $s->execute();
    jsonResponse(['success'=>true]);
}

/* ────────────────────────────────────────────────────────────
   DELETE /api/tests.php?action=delete_test
──────────────────────────────────────────────────────────── */
if ($method === 'DELETE' && $action === 'delete_test') {
    $d  = json_decode(file_get_contents('php://input'), true);
    $id = (int)($d['id'] ?? 0);
    if (!$id) jsonError('id required.');
    $s = $db->prepare('DELETE FROM tests WHERE id=?');
    $s->bind_param('i', $id); $s->execute();
    jsonResponse(['success'=>true,'message'=>'Test deleted.']);
}

/* ────────────────────────────────────────────────────────────
   POST /api/tests.php?action=start_attempt
   Start a test attempt
──────────────────────────────────────────────────────────── */
if ($method === 'POST' && $action === 'start_attempt') {
    $d   = json_decode(file_get_contents('php://input'), true);
    $tid = (int)($d['test_id'] ?? 0);
    $uid = (int)($d['user_id'] ?? 0);
    if (!$tid || !$uid) jsonError('test_id and user_id required.');

    // Check max attempts
    $s = $db->prepare('SELECT t.max_attempts, (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id=? AND ta.user_id=? AND ta.submitted_at IS NOT NULL) AS taken FROM tests t WHERE t.id=?');
    $s->bind_param('iii', $tid, $uid, $tid);
    $s->execute();
    $row = $s->get_result()->fetch_assoc();
    if (!$row) jsonError('Test not found.', 404);
    if ((int)$row['taken'] >= (int)$row['max_attempts']) jsonError('Maximum attempts reached.', 409);

    $attemptNo = (int)$row['taken'] + 1;
    $s2 = $db->prepare('INSERT INTO test_attempts (test_id,user_id,attempt_no) VALUES (?,?,?)');
    $s2->bind_param('iii', $tid, $uid, $attemptNo);
    $s2->execute();
    jsonResponse(['success'=>true,'attempt_id'=>$db->insert_id,'attempt_no'=>$attemptNo]);
}

/* ────────────────────────────────────────────────────────────
   POST /api/tests.php?action=submit
   Submit test answers — auto-grade
──────────────────────────────────────────────────────────── */
if ($method === 'POST' && $action === 'submit') {
    $d          = json_decode(file_get_contents('php://input'), true);
    $attemptId  = (int)($d['attempt_id'] ?? 0);
    $answers    = $d['answers'] ?? [];   // [{question_id, chosen_ans}, ...]
    if (!$attemptId) jsonError('attempt_id required.');

    // Get correct answers for this attempt's test
    $s = $db->prepare('SELECT ta.test_id FROM test_attempts ta WHERE ta.id=?');
    $s->bind_param('i', $attemptId); $s->execute();
    $row = $s->get_result()->fetch_assoc();
    if (!$row) jsonError('Attempt not found.', 404);
    $testId = (int)$row['test_id'];

    $s2 = $db->prepare('SELECT id, correct_ans, marks FROM questions WHERE test_id=?');
    $s2->bind_param('i', $testId); $s2->execute();
    $questions = $s2->get_result()->fetch_all(MYSQLI_ASSOC);

    $correctMap = [];
    $totalMarks = 0;
    foreach ($questions as $q) {
        $correctMap[$q['id']] = ['ans'=>$q['correct_ans'], 'marks'=>(int)$q['marks']];
        $totalMarks += (int)$q['marks'];
    }

    $score = 0;
    $insStmt = $db->prepare('INSERT INTO test_answers (attempt_id,question_id,chosen_ans,is_correct) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE chosen_ans=VALUES(chosen_ans),is_correct=VALUES(is_correct)');

    foreach ($answers as $a) {
        $qid       = (int)$a['question_id'];
        $chosen    = strtolower(trim($a['chosen_ans'] ?? ''));
        if (!isset($correctMap[$qid])) continue;
        $correct   = $correctMap[$qid]['ans'];
        $isCorrect = ($chosen === $correct) ? 1 : 0;
        if ($isCorrect) $score += $correctMap[$qid]['marks'];
        // FIX: attempt_id=i, question_id=i, chosen_ans=s, is_correct=i
        $insStmt->bind_param('iisi', $attemptId, $qid, $chosen, $isCorrect);
        $insStmt->execute();
    }

    // Get test pass_percent
    $s3 = $db->prepare('SELECT pass_percent FROM tests WHERE id=?');
    $s3->bind_param('i', $testId); $s3->execute();
    $test = $s3->get_result()->fetch_assoc();
    $pct    = $totalMarks > 0 ? round($score / $totalMarks * 100, 2) : 0;
    $passed = ($pct >= (int)$test['pass_percent']) ? 1 : 0;

    $upd = $db->prepare('UPDATE test_attempts SET score=?,total_marks=?,percent=?,passed=?,submitted_at=NOW() WHERE id=?');
    $upd->bind_param('iidii', $score, $totalMarks, $pct, $passed, $attemptId);
    $upd->execute();

    ob_end_clean();
    jsonResponse([
        'success'     => true,
        'score'       => (int)$score,
        'total_marks' => (int)$totalMarks,
        'percent'     => (float)$pct,
        'passed'      => (bool)$passed,
        'message'     => $passed ? "Congratulations! You passed with {$pct}%." : "You scored {$pct}%. Keep practicing!"
    ]);
}

jsonError('Invalid action or method.', 405);