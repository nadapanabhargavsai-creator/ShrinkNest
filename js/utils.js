// ==========================================
// SHRINKNEST UTILITIES
// File: js/utils.js
// ==========================================

// Format bytes into readable size
export function formatFileSize(bytes) {

    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];

}

// Calculate compression percentage
export function calculateSavedPercentage(originalSize, compressedSize) {

    if (originalSize <= 0) return 0;

    return (
        ((originalSize - compressedSize) / originalSize) * 100
    ).toFixed(1);

}

// Format date/time
export function formatDate(date = new Date()) {

    return new Intl.DateTimeFormat("en-IN", {

        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"

    }).format(date);

}

// Generate random ID
export function generateId(length = 12) {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let id = "";

    for (let i = 0; i < length; i++) {

        id += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );

    }

    return id;

}

// Download Blob/File
export function downloadBlob(blob, fileName) {

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

}

// Debounce helper
export function debounce(callback, delay = 300) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(() => {

            callback(...args);

        }, delay);

    };

}

// Sleep helper
export function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

// ==========================================
// END OF FILE
// ==========================================