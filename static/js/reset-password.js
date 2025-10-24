let resetToken = null;

// Check if token is in URL
const urlParams = new URLSearchParams(window.location.search);
resetToken = urlParams.get('token');

if (resetToken) {
    showScreen('set-password-screen');
}

// Request reset form
document.getElementById('request-reset-form')?.addEventListener('submit', handleRequestReset);

async function handleRequestReset(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    const email = document.getElementById('email').value;
    
    try {
        const response = await fetch('/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send reset email');
        }
        
        showScreen('reset-sent-screen');
        
    } catch (error) {
        showToast('Failed to send reset link. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Send Reset Link →';
    }
}

// Set password form
document.getElementById('set-password-form')?.addEventListener('submit', handleSetPassword);

async function handleSetPassword(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Resetting...';
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        btn.disabled = false;
        btn.textContent = 'Reset Password →';
        return;
    }
    
    try {
        const response = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: resetToken,
                new_password: newPassword
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to reset password');
        }
        
        showScreen('success-screen');
        
    } catch (error) {
        showToast(error.message || 'Failed to reset password', 'error');
        btn.disabled = false;
        btn.textContent = 'Reset Password →';
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
