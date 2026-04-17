<?php
// ============================================================
//  config/cors.php  —  CORS + JSON headers for all API files
// ============================================================

// Allow requests from your frontend (adjust origin if needed)
header('Access-Control-Allow-Origin: *');
// FIXED: added DELETE; added Authorization header support
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Handle pre-flight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
