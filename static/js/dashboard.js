// Check if user is logged in
const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '/login';
}

// Load dashboard data
loadDashboard();

async function loadDashboard() {
    try {
        const companyId = localStorage.getItem('company_id');
        
        // Load company details
        const companyResponse = await fetch(`/companies/${companyId}`);
        if (!companyResponse.ok) {
            throw new Error('Failed to load company data');
        }
        const company = await companyResponse.json();
        
        // Load subscription
        const subResponse = await fetch(`/companies/${companyId}/subscription`);
        let subscription = null;
        if (subResponse.ok) {
            subscription = await subResponse.json();
        }
        
        // Update UI
        document.getElementById('company-name-header').textContent = company.legal_name || 'Company';
        document.getElementById('company-name').textContent = company.legal_name || 'Not provided';
        document.getElementById('company-email').textContent = company.email || 'Not provided';
        document.getElementById('business-type').textContent = company.business_type || 'Not provided';
        document.getElementById('company-id').textContent = company.id;
        document.getElementById('account-status').textContent = company.status;
        
        if (subscription && subscription.plan) {
            document.getElementById('plan-name').textContent = subscription.plan.name || 'Free';
            document.getElementById('plan-price').textContent = `$${subscription.plan.price_monthly}/month`;
            document.getElementById('invoice-limit').textContent = subscription.plan.max_invoices_per_month || 'Unlimited';
        } else {
            document.getElementById('plan-name').textContent = 'No Plan';
            document.getElementById('plan-price').textContent = '$0/month';
            document.getElementById('invoice-limit').textContent = '0';
        }
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('company_id');
    localStorage.removeItem('company_name');
    window.location.href = '/login';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
