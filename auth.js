// auth.js
// Здесь может быть логика аутентификации, если она у вас есть
// Например, функции для проверки логина и пароля

function checkCredentials(username, password) {
    // Здесь должна быть реальная проверка учетных данных
    // Это пример, который всегда возвращает true для пользователя 'admin' и пароля 'password123'
    return username === 'admin' && password === '123';
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
}

function isLoggedIn() {
    return !!getAuthToken();
}

function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const authSection = document.getElementById('auth-section');
    const adminContent = document.getElementById('admin-content');  // Get admin content

    if (checkCredentials(username, password)) {
        setAuthToken('admin_token');
        // Add d-none class to auth-section   В этом случае класс будет добавлен
        if (authSection) {
            authSection.classList.add('d-none');
        }
    //  if (adminContent) {
    //         adminContent.style.display = 'block'; // Show admin content
    //   }
        showAdminContent();
        initAdminPanel();
    } else {
        showToast('Неверное имя пользователя или пароль.', 'red');
    }
}

// Add this function at the beginning of auth.js file.
function showToast(message, color) {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        backgroundColor: color,
    }).showToast();
}