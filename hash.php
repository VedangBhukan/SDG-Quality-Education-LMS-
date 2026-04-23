<?php
echo "Admin: " . password_hash('Admin@123', PASSWORD_BCRYPT) . "<br>";
echo "Teacher: " . password_hash('Teacher@123', PASSWORD_BCRYPT) . "<br>";
echo "Student: " . password_hash('demo123', PASSWORD_BCRYPT) . "<br>";