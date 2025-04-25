// other.js
// Reset Button Logic
const resetButton = document.getElementById('resetButton');
let resetTimeout; // Timer for reset
let holdDuration = 0; // Hold duration in milliseconds
const holdThreshold = 5000; // 5 seconds in milliseconds

// Function to initiate the reset process
function startHold() {
    holdDuration = 0; // Reset hold duration
    resetButton.classList.add('holding'); 
    resetTimeout = setInterval(() => {
        holdDuration += 100; // Increase hold duration by 100ms
        const progress = Math.min(holdDuration / holdThreshold, 1); // Calculate progress as a percentage (max 1)
        resetButton.style.background = `linear-gradient(to right, black ${progress * 100}%, #f44336 0%)`; // Update the background gradient
        
        if (progress === 1) {
            // If hold duration has reached threshold, reset and clear interval
            triggerReset();
            clearInterval(resetTimeout);
        }
    }, 100); // Update every 100ms
}

// Function to cancel the hold if the mouse is released
function cancelHold() {
    clearInterval(resetTimeout); // Stop the timer
    resetButton.classList.remove('holding'); // Remove holding class
    resetButton.style.background = ''; // Reset button background
}

// Reset action (only called if held for 5 seconds)
function triggerReset() {
    resetButton.classList.remove('holding'); // Remove holding class after reset
    resetButton.style.background = ''; // Reset button background

    // Resetting all inputs to their default values
    document.getElementById('version').value = 1;
    document.getElementById('errorCorrection').value = 'L';
    document.getElementById('maskPattern').value = '0';
    document.getElementById('staticToggle').checked = false;
    document.getElementById('formatInfoInput').value = ''; // Clear this
    // Re-set version info to default for version 7+ only if applicable
    // Keep the default V7 string in the input for now, initGrid handles V<7
    document.getElementById('versionInfoInput').value = '000111110010010100';
    // Clear the data textarea
    document.getElementById('qrData').value = '';


    initGrid();
}

// Event listeners for holding down and releasing the reset button
resetButton.addEventListener('mousedown', startHold);
resetButton.addEventListener('mouseup', cancelHold);
resetButton.addEventListener('mouseleave', cancelHold);
