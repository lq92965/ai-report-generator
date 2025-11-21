/*
 * ===================================================================
 * * Reportify AI - Profile Page Script (v5.0 Clean)
 * * PURPOSE: Handles profile updates, avatar uploads, and form logic.
 * * (Cleaned of duplicate navigation code & syntax errors)
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

// --- Page Protection ---
if (!token) {
    // alert('Please log in to access your profile.');
    // window.location.href = 'index.html'; 
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const profileForm = document.getElementById('profile-form');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');
    const avatarPreview = document.getElementById('avatar-preview');

    if (!profileForm || !avatarUploadBtn) {
        console.warn('Profile form elements not found.');
        return;
    }

    // 1. Load Profile Data
    fetchUserProfile();

    // 2. Bind Form Submit
    profileForm.addEventListener('submit', handleProfileSubmit);

    // 3. Bind Avatar Upload
    avatarUploadBtn.addEventListener('click', () => avatarUploadInput.click());

    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Local Preview
        const reader = new FileReader();
        reader.onload = (ev) => { 
            if(avatarPreview) avatarPreview.src = ev.target.result; 
        };
        reader.readAsDataURL(file);

        // Upload to Server
        uploadAvatar(file);
    });
});

/**
 * Fetch and display user profile
 */
async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/me`, { 
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
            }
            throw new Error('Could not fetch user profile');
        }

        const user = await response.json();

        // Fill Form
        const profileEmailInput = document.getElementById('profile-email');
        const profileNameInput = document.getElementById('profile-name');
        const profileBioInput = document.getElementById('profile-bio');
        const profileJobInput = document.getElementById('profile-job');
        const avatarPreview = document.getElementById('avatar-preview');

        if (profileEmailInput) profileEmailInput.value = user.email;
        if (profileNameInput) profileNameInput.value = user.displayName || ''; 
        if (profileBioInput) profileBioInput.value = user.bio || '';
        if (profileJobInput) profileJobInput.value = user.jobTitle || '';

        // Show Avatar
        if (avatarPreview) {
            if (user.avatarUrl && user.avatarUrl !== 'https://via.placeholder.com/150') {
                avatarPreview.src = user.avatarUrl;
            } else {
                const userInitial = (user.displayName || user.email.split('@')[0])[0].toUpperCase();
                // Create SVG Placeholder
                avatarPreview.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#f0f0f0"></rect><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#999">${userInitial}</text></svg>')}`;
            }
        }

        // Update Global Nav
        if (window.updateUserNav) {
            window.updateUserNav(user);
        }

    } catch (error) {
        console.error('Error fetching user profile:', error);
        showStatusMessage('Could not load your profile', true);
    }
}

/**
 * Handle Profile Update
 */
async function handleProfileSubmit(e) {
    e.preventDefault(); 
    
    const profileNameInput = document.getElementById('profile-name');
    const profileBioInput = document.getElementById('profile-bio');
    const profileJobInput = document.getElementById('profile-job');

    const newName = profileNameInput.value.trim();
    const newBio = profileBioInput.value.trim();
    const newJob = profileJobInput.value.trim();

    if (!newName) {
        showStatusMessage('Display Name cannot be empty', true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/profile`, { 
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ displayName: newName, bio: newBio, jobTitle: newJob })
        });
        
        if (!response.headers.get("content-type")?.includes("application/json")) {
           const text = await response.text();
           throw new Error(`Server Error: ${text.substring(0, 50)}...`);
        }

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Update failed');

        const updatedUser = result.user;

        showStatusMessage('Profile updated successfully!', false);
        profileNameInput.value = updatedUser.displayName; 
        profileBioInput.value = updatedUser.bio;
        profileJobInput.value = updatedUser.jobTitle;

        // Refresh Global Nav with new data
        if (window.updateUserNav) {
            window.updateUserNav(updatedUser); 
        }

    } catch (error) {
        console.error('Error updating profile:', error);
        showStatusMessage(error.message, true);
    }
}

/**
 * Upload Avatar
 */
async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file); 

    showStatusMessage('Uploading new avatar...', false);
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');
    if(avatarUploadBtn) {
        avatarUploadBtn.disabled = true;
        avatarUploadBtn.textContent = 'Uploading...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Upload failed');

        showStatusMessage('Avatar updated successfully!', false);
        
        const newAvatarUrl = result.avatarUrl;
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) avatarPreview.src = newAvatarUrl; 

        // (!!!) Fixed: Correct syntax for if statement
        if (window.updateUserNav) {
            window.updateUserNav(); // Refresh Nav
        }

    } catch (error) {
        console.error('Error uploading avatar:', error);
        showStatusMessage(error.message, true);
    } finally {
        if(avatarUploadBtn) {
            avatarUploadBtn.disabled = false;
            avatarUploadBtn.textContent = 'Upload New Picture';
        }
    }
}

/**
 * Show status message
 */
function showStatusMessage(message, isError) {
    const profileStatus = document.getElementById('profile-status');
    if (!profileStatus) return;

    profileStatus.textContent = message;
    profileStatus.className = isError ? 'status-message error-message' : 'status-message success-message';
    profileStatus.style.display = 'block';

    setTimeout(() => {
        profileStatus.textContent = '';
        profileStatus.className = 'status-message';
        profileStatus.style.display = 'none';
    }, 5000);
}
