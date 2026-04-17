<?php
// ============================================================
//  api/courses.php  —  GET: Fetch all courses
//  Optional query param: ?category=design
// ============================================================

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$db       = getDB();
$category = $_GET['category'] ?? '';

if ($category && $category !== 'all') {
    $stmt = $db->prepare('SELECT * FROM courses WHERE category = ?');
    $stmt->bind_param('s', $category);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $db->query('SELECT * FROM courses');
}

$courses = [];
while ($row = $result->fetch_assoc()) {
    // Cast types so JSON looks right
    $row['id']      = (int)$row['id'];
    $row['lessons'] = (int)$row['lessons'];
    $row['rating']  = (float)$row['rating'];
    $courses[]      = $row;
}

echo json_encode(['success' => true, 'courses' => $courses]);
