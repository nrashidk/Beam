let currentStep = 1;
let companyId = null;
let selectedPlanId = null;
let formData = {};
let uploadedFiles = {
    business_license: null,
    trn_certificate: null
};

document.addEventListener('DOMContentLoaded', function() {
    initializeRegistration();
    setupFileUploads();
    setupFormSubmission();
});

async function initializeRegistration() {
    try {
        const response = await fetch('/register/init', {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to initialize registration');
        }
        
        const data = await response.json();
        companyId = data.company_id;
        console.log('Registration initialized:', companyId);
    } catch (error) {
        showError('Failed to initialize registration. Please refresh the page.');
        console.error(error);
    }
}

function setupFileUploads() {
    const businessLicenseInput = document.getElementById('business_license');
    const trnCertificateInput = document.getElementById('trn_certificate');
    
    businessLicenseInput.addEventListener('change', function(e) {
        handleFileSelect(e, 'business_license', 'BUSINESS_LICENSE');
    });
    
    trnCertificateInput.addEventListener('change', function(e) {
        handleFileSelect(e, 'trn_certificate', 'TRN_CERTIFICATE');
    });
}

async function handleFileSelect(event, inputId, docType) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        showError('File size must be less than 5MB');
        event.target.value = '';
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType);
    
    try {
        const response = await fetch(`/register/${companyId}/documents`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload file');
        }
        
        const data = await response.json();
        uploadedFiles[inputId] = data;
        
        showFilePreview(inputId, file.name);
        showSuccess(`${file.name} uploaded successfully`);
    } catch (error) {
        showError('Failed to upload file. Please try again.');
        console.error(error);
        event.target.value = '';
    }
}

function showFilePreview(inputId, fileName) {
    const uploadArea = document.getElementById(inputId).parentElement;
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const preview = uploadArea.querySelector('.file-preview');
    
    placeholder.style.display = 'none';
    preview.style.display = 'flex';
    preview.innerHTML = `
        <div class="file-info">
            <span>📄</span>
            <span class="file-name">${fileName}</span>
        </div>
        <button type="button" class="remove-file" onclick="removeFile('${inputId}')">Remove</button>
    `;
}

function removeFile(inputId) {
    const input = document.getElementById(inputId);
    const uploadArea = input.parentElement;
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const preview = uploadArea.querySelector('.file-preview');
    
    input.value = '';
    uploadedFiles[inputId] = null;
    placeholder.style.display = 'block';
    preview.style.display = 'none';
}

function nextStep() {
    if (!validateCurrentStep()) {
        return;
    }
    
    saveCurrentStepData();
    
    if (currentStep === 1) {
        submitStep1();
    } else if (currentStep === 2) {
        submitStep2();
    } else if (currentStep === 3) {
        submitStep3();
    } else if (currentStep === 4) {
        if (!selectedPlanId) {
            showError('Please select a subscription plan');
            return;
        }
        submitStep4();
    }
    
    if (currentStep < 5) {
        currentStep++;
        updateStepDisplay();
        
        if (currentStep === 4) {
            loadPlans();
        } else if (currentStep === 5) {
            showReview();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
    }
}

function updateStepDisplay() {
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < currentStep) {
            step.classList.add('completed');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
        }
    });
    
    document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
    const currentStepElement = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const inputs = currentStepElement.querySelectorAll('input[required], select[required]');
    
    for (let input of inputs) {
        if (!input.value.trim()) {
            showError('Please fill in all required fields');
            input.focus();
            return false;
        }
    }
    
    if (currentStep === 3) {
        if (!uploadedFiles.business_license) {
            showError('Please upload your Business License');
            return false;
        }
    }
    
    if (currentStep === 5) {
        const termsCheckbox = document.getElementById('terms_agreed');
        if (!termsCheckbox.checked) {
            showError('Please agree to the Terms of Service and Privacy Policy');
            return false;
        }
    }
    
    return true;
}

function saveCurrentStepData() {
    const currentStepElement = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const inputs = currentStepElement.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        if (input.type !== 'file' && input.type !== 'checkbox') {
            formData[input.name || input.id] = input.value;
        }
    });
}

async function submitStep1() {
    const data = {
        legal_name: document.getElementById('legal_name').value,
        business_type: document.getElementById('business_type').value,
        registration_number: document.getElementById('registration_number').value,
        registration_date: document.getElementById('registration_date').value || null,
        business_activity: document.getElementById('business_activity').value
    };
    
    try {
        const response = await fetch(`/register/${companyId}/step1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit step 1');
        }
        
        console.log('Step 1 submitted successfully');
    } catch (error) {
        showError('Failed to save company information');
        console.error(error);
    }
}

async function submitStep2() {
    const data = {
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        website: document.getElementById('website').value || null,
        trn: document.getElementById('trn').value || null,
        address_line1: document.getElementById('address_line1').value,
        address_line2: document.getElementById('address_line2').value || null,
        city: document.getElementById('city').value,
        emirate: document.getElementById('emirate').value,
        po_box: document.getElementById('po_box').value || null,
        authorized_person_name: document.getElementById('authorized_person_name').value,
        authorized_person_title: document.getElementById('authorized_person_title').value,
        authorized_person_email: document.getElementById('authorized_person_email').value,
        authorized_person_phone: document.getElementById('authorized_person_phone').value
    };
    
    try {
        const response = await fetch(`/register/${companyId}/step2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit step 2');
        }
        
        console.log('Step 2 submitted successfully');
    } catch (error) {
        showError('Failed to save business details');
        console.error(error);
    }
}

async function submitStep3() {
    try {
        const response = await fetch(`/register/${companyId}/step3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verified: true })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit step 3');
        }
        
        console.log('Step 3 submitted successfully');
    } catch (error) {
        showError('Failed to verify documents');
        console.error(error);
    }
}

async function submitStep4() {
    try {
        const response = await fetch(`/register/${companyId}/step4`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: selectedPlanId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit step 4');
        }
        
        console.log('Step 4 submitted successfully');
    } catch (error) {
        showError('Failed to save plan selection');
        console.error(error);
    }
}

async function loadPlans() {
    const container = document.getElementById('plans-container');
    
    try {
        const response = await fetch('/plans');
        if (!response.ok) {
            throw new Error('Failed to load plans');
        }
        
        const plans = await response.json();
        
        container.innerHTML = plans.map(plan => `
            <div class="plan-card" onclick="selectPlan('${plan.id}', this)">
                <div class="plan-name">${plan.name}</div>
                <div class="plan-price">$${plan.price_monthly}<span>/month</span></div>
                <div class="plan-description">${plan.description}</div>
                <ul class="plan-features">
                    <li>${plan.max_invoices_per_month || 'Unlimited'} invoices/month</li>
                    <li>${plan.max_users} users</li>
                    ${plan.allow_api_access ? '<li>API Access</li>' : ''}
                    ${plan.allow_branding ? '<li>Custom Branding</li>' : ''}
                </ul>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error-message">Failed to load plans. Please refresh the page.</div>';
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

function showReview() {
    const reviewContent = document.getElementById('review-content');
    
    const planName = selectedPlanId ? selectedPlanId.replace('plan_', '').charAt(0).toUpperCase() + selectedPlanId.replace('plan_', '').slice(1) : 'Not selected';
    
    reviewContent.innerHTML = `
        <div class="review-group">
            <h3>Company Information</h3>
            <div class="review-item">
                <span class="review-label">Legal Name:</span>
                <span class="review-value">${formData.legal_name || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Business Type:</span>
                <span class="review-value">${formData.business_type || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Registration Number:</span>
                <span class="review-value">${formData.registration_number || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Business Activity:</span>
                <span class="review-value">${formData.business_activity || 'N/A'}</span>
            </div>
        </div>
        
        <div class="review-group">
            <h3>Contact Information</h3>
            <div class="review-item">
                <span class="review-label">Email:</span>
                <span class="review-value">${formData.email || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Phone:</span>
                <span class="review-value">${formData.phone || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Address:</span>
                <span class="review-value">${formData.address_line1 || 'N/A'}, ${formData.city || ''}, ${formData.emirate || ''}</span>
            </div>
        </div>
        
        <div class="review-group">
            <h3>Authorized Person</h3>
            <div class="review-item">
                <span class="review-label">Name:</span>
                <span class="review-value">${formData.authorized_person_name || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Title:</span>
                <span class="review-value">${formData.authorized_person_title || 'N/A'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Email:</span>
                <span class="review-value">${formData.authorized_person_email || 'N/A'}</span>
            </div>
        </div>
        
        <div class="review-group">
            <h3>Documents</h3>
            <div class="review-item">
                <span class="review-label">Business License:</span>
                <span class="review-value">${uploadedFiles.business_license ? '✓ Uploaded' : '✗ Not uploaded'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">TRN Certificate:</span>
                <span class="review-value">${uploadedFiles.trn_certificate ? '✓ Uploaded' : '✗ Not uploaded'}</span>
            </div>
        </div>
        
        <div class="review-group">
            <h3>Selected Plan</h3>
            <div class="review-item">
                <span class="review-label">Plan:</span>
                <span class="review-value">${planName}</span>
            </div>
        </div>
    `;
}

function setupFormSubmission() {
    document.getElementById('registration-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateCurrentStep()) {
            return;
        }
        
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        try {
            const response = await fetch(`/register/${companyId}/finalize`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to submit registration');
            }
            
            const data = await response.json();
            
            showSuccess('Registration submitted successfully! Our team will review your application and get back to you soon.');
            
            setTimeout(() => {
                window.location.reload();
            }, 3000);
            
        } catch (error) {
            showError('Failed to submit registration. Please try again.');
            console.error(error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application';
        }
    });
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
