// Function to handle the click event on the "Generate Report" button
const generateReport = () => {
    // Get the values from the input fields
    const workPoints = document.getElementById('workInput').value;
    const language = document.getElementById('languageSelect').value;
    const style = document.getElementById('styleSelect').value;
    const length = document.getElementById('lengthSelect').value;
    const resultOutput = document.getElementById('resultOutput');

    // Simple validation to ensure work points are entered
    if (workPoints.trim() === '') {
        resultOutput.value = "Please enter some work points to generate a report.";
        return;
    }

    // Placeholder text for the generated report
    const placeholderReport = `
    Generated Report
    ---------------------
    Work Points: ${workPoints}
    Language: ${language}
    Style: ${style}
    Length: ${length}

    This is a placeholder for the generated report. In a real application, a model would process the input to create a detailed report here.
    `;
    
    resultOutput.value = placeholderReport;
};

// Function to copy the generated report to the clipboard
const copyReport = () => {
    const resultOutput = document.getElementById('resultOutput');
    resultOutput.select();
    try {
        // Use the deprecated but widely supported execCommand for copying in iframes
        document.execCommand('copy');
        alert("Report copied to clipboard!");
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
};

// Function to show the feedback modal
const showModal = () => {
    const modal = document.getElementById('feedbackModal');
    modal.style.display = 'flex';
};

// Function to hide the feedback modal
const hideModal = () => {
    const modal = document.getElementById('feedbackModal');
    modal.style.display = 'none';
};

// Attach event listeners to the buttons and links
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generateBtn').addEventListener('click', generateReport);
    document.getElementById('copyBtn').addEventListener('click', copyReport);
    document.getElementById('feedbackLink').addEventListener('click', (e) => {
        e.preventDefault();
        showModal();
    });
    document.querySelector('.close-btn').addEventListener('click', hideModal);
    document.getElementById('feedbackModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideModal();
        }
    });

    // Handle form submission to prevent default behavior
    document.getElementById('feedbackForm').addEventListener('submit', (e) => {
        e.preventDefault();
        // Here you would typically send the form data to a server
        console.log('Feedback submitted!');
        hideModal();
    });
});