let companyId = null;
let selectedPlanId = null;
let userData = {};

document.getElementById('email-form')?.addEventListener('submit', handleEmailSubmit);

async function handleEmailSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const companyName = document.getElementById('company_name').value;
    
    userData.email = email;
    userData.company_name = companyName;
    
    try {
        const response = await fetch('/register/init', {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to initialize');
        
        const data = await response.json();
        companyId = data.company_id;
        
        await fetch(`/register/${companyId}/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                legal_name: companyName,
                email: email,
                business_type: null,
                registration_number: null,
                business_activity: null
            })
        });
        
        showScreen('onboarding-screen');
        loadPlans();
    } catch (error) {
        showToast('Failed to start registration. Please try again.', 'error');
        console.error(error);
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function goToStep(stepNumber) {
    if (stepNumber === 2 && !validateStep1()) {
        return;
    }
    
    if (stepNumber === 2) {
        saveStep1();
    }
    
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    
    document.getElementById('current-step').textContent = stepNumber;
    document.getElementById('progress-bar').style.width = `${(stepNumber / 2) * 100}%`;
}

function validateStep1() {
    const required = ['business_type', 'registration_number', 'phone', 'address', 'emirate'];
    
    for (const field of required) {
        const value = document.getElementById(field).value.trim();
        if (!value) {
            showToast('Please fill in all required fields', 'error');
            document.getElementById(field).focus();
            return false;
        }
    }
    
    return true;
}

async function saveStep1() {
    userData.business_type = document.getElementById('business_type').value;
    userData.registration_number = document.getElementById('registration_number').value;
    userData.phone = document.getElementById('phone').value;
    userData.trn = document.getElementById('trn').value || null;
    userData.address = document.getElementById('address').value;
    userData.emirate = document.getElementById('emirate').value;
    
    try {
        await fetch(`/register/${companyId}/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                legal_name: userData.company_name,
                business_type: userData.business_type,
                registration_number: userData.registration_number,
                business_activity: 'General Business',
                email: userData.email
            })
        });
        
        await fetch(`/register/${companyId}/step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userData.email,
                phone: userData.phone,
                trn: userData.trn,
                address_line1: userData.address,
                city: userData.emirate,
                emirate: userData.emirate,
                authorized_person_name: 'Admin',
                authorized_person_title: 'Manager',
                authorized_person_email: userData.email,
                authorized_person_phone: userData.phone
            })
        });
    } catch (error) {
        console.error('Failed to save step 1:', error);
    }
}

async function loadPlans() {
    const container = document.getElementById('plans-container');
    
    try {
        const response = await fetch('/plans');
        if (!response.ok) throw new Error('Failed to load plans');
        
        const plans = await response.json();
        
        container.innerHTML = plans.map(plan => `
            <div class="plan-card" onclick="selectPlan('${plan.id}', this)">
                <div class="plan-name">${plan.name}</div>
                <div class="plan-price">$${plan.price_monthly}<span>/mo</span></div>
                <ul class="plan-features">
                    <li>${plan.max_invoices_per_month || 'Unlimited'} invoices</li>
                    <li>${plan.max_users} users</li>
                    ${plan.allow_api_access ? '<li>API access</li>' : ''}
                </ul>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="loading-spinner">Failed to load plans</div>';
        console.error(error);
    }
}

function selectPlan(planId, element) {
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedPlanId = planId;
}

async function submitOnboarding() {
    if (!selectedPlanId) {
        showToast('Please select a plan', 'error');
        return;
    }
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    try {
        await fetch(`/register/${companyId}/step4`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: selectedPlanId })
        });
        
        await fetch(`/register/${companyId}/finalize`, {
            method: 'POST'
        });
        
        document.getElementById('confirmed-email').textContent = userData.email;
        showScreen('success-screen');
    } catch (error) {
        showToast('Failed to submit. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Complete Setup';
        console.error(error);
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
