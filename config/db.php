<?php
// ============================================================
//  config/db.php  —  Database connection (XAMPP defaults)
// ============================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');       // XAMPP default username
define('DB_PASS', '');           // XAMPP default password (empty)
define('DB_NAME', 'skillstack_db');

function getDB(): mysqli {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            http_response_code(500);
            die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
        }
        $conn->set_charset('utf8mb4');
    }
    return $conn;
}
