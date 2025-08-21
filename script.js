// Function to handle the click event on the "Generate Report" button
const generateReport = async () => {
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

    // Set a loading message
    resultOutput.value = "Generating report, please wait...";

    const prompt = `Generate a ${length} report in a ${style} tone based on the following work points. The report should be in ${language}. Work points: ${workPoints}`;
    
    // API setup
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429) { // Too Many Requests
                    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue; // Retry the request
                } else {
                    throw new Error(`API call failed with status: ${response.status}`);
                }
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                resultOutput.value = text;
            } else {
                resultOutput.value = "Failed to generate report. Please try again.";
            }
            return; // Exit the function after a successful API call or a final error
        } catch (error) {
            console.error('Error generating report:', error);
            resultOutput.value = `An error occurred: ${error.message}`;
            return;
        }
    }

    resultOutput.value = "API call failed after multiple retries. Please try again later.";
};

// Function to show a temporary message box
const showMessage = (message) => {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000); // Hide after 3 seconds
};

// Function to copy the generated report to the clipboard
const copyReport = () => {
    const resultOutput = document.getElementById('resultOutput');
    resultOutput.select();
    try {
        // Use the deprecated but widely supported execCommand for copying in iframes
        document.execCommand('copy');
        showMessage("Report copied to clipboard!");
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showMessage("Failed to copy text.");
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