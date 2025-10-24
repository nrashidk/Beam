let companyId = null;
let userData = {};

document.getElementById('signup-form')?.addEventListener('submit', handleSignup);

async function handleSignup(e) {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    
    const email = document.getElementById('email').value;
    const companyName = document.getElementById('company_name').value;
    const businessType = document.getElementById('business_type').value;
    const phone = document.getElementById('phone').value;
    
    userData.email = email;
    
    try {
        const initResponse = await fetch('/register/init', {
            method: 'POST'
        });
        
        if (!initResponse.ok) throw new Error('Failed to initialize');
        
        const initData = await initResponse.json();
        companyId = initData.company_id;
        
        await fetch(`/register/${companyId}/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                legal_name: companyName,
                business_type: businessType,
                registration_number: 'TBD',
                business_activity: 'General Business',
                email: email
            })
        });
        
        await fetch(`/register/${companyId}/step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                phone: phone,
                trn: null,
                address_line1: 'TBD',
                city: 'Dubai',
                emirate: 'Dubai',
                authorized_person_name: companyName,
                authorized_person_title: 'Administrator',
                authorized_person_email: email,
                authorized_person_phone: phone
            })
        });
        
        const finalizeResponse = await fetch(`/register/${companyId}/finalize`, {
            method: 'POST'
        });
        
        if (!finalizeResponse.ok) throw new Error('Failed to finalize');
        
        document.getElementById('confirmed-email').textContent = email;
        showScreen('success-screen');
        
    } catch (error) {
        showToast('Registration failed. Please try again.', 'error');
        console.error(error);
        btn.disabled = false;
        btn.textContent = 'Create Free Account →';
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
