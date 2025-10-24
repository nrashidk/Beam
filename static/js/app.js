let companyId = null;
let userEmail = null;

document.getElementById('signup-form')?.addEventListener('submit', handleSignup);

async function handleSignup(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    
    const email = document.getElementById('email').value;
    const companyName = document.getElementById('company_name').value;
    
    userEmail = email;
    
    try {
        const initResponse = await fetch('/register/init', {
            method: 'POST'
        });
        
        if (!initResponse.ok) throw new Error('Failed to initialize');
        
        const initData = await initResponse.json();
        companyId = initData.company_id;
        
        const registerResponse = await fetch(`/register/${companyId}/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                legal_name: companyName,
                business_type: 'LLC',
                registration_number: 'PENDING',
                business_activity: 'General Business',
                email: email
            })
        });
        
        if (!registerResponse.ok) throw new Error('Failed to register');
        
        await fetch(`/register/${companyId}/step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                phone: 'TBD',
                trn: null,
                address_line1: 'TBD',
                city: 'Dubai',
                emirate: 'Dubai',
                authorized_person_name: companyName,
                authorized_person_title: 'Administrator',
                authorized_person_email: email,
                authorized_person_phone: 'TBD'
            })
        });
        
        const verifyResponse = await fetch(`/register/${companyId}/send-verification`, {
            method: 'POST'
        });
        
        if (!verifyResponse.ok) throw new Error('Failed to send verification');
        
        document.getElementById('sent-email').textContent = email;
        showScreen('verify-email-screen');
        
    } catch (error) {
        showToast('Registration failed. Please try again.', 'error');
        console.error(error);
        btn.disabled = false;
        btn.textContent = 'Create Free Account →';
    }
}

async function resendVerification() {
    if (!companyId) return;
    
    try {
        await fetch(`/register/${companyId}/send-verification`, {
            method: 'POST'
        });
        showToast('Verification email resent!', 'success');
    } catch (error) {
        showToast('Failed to resend email', 'error');
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

const urlParams = new URLSearchParams(window.location.search);
const verifyToken = urlParams.get('verify');

if (verifyToken) {
    fetch(`/register/verify/${verifyToken}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('confirmed-email').textContent = data.email;
            showScreen('success-screen');
        } else {
            showToast('Invalid or expired verification link', 'error');
        }
    })
    .catch(error => {
        showToast('Verification failed', 'error');
    });
}
