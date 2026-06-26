// ==========================================
// SHRINKNEST IMAGE COMPRESSOR
// File: js/image-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";
import { calculateSavedPercentage, formatFileSize } from "./utils.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const uploadInput = document.getElementById("imageFile");
const qualitySlider = document.getElementById("qualitySlider");
const compressBtn = document.getElementById("compressBtn");
const downloadBtn = document.getElementById("downloadBtn");

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");

const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

let selectedFile = null;
let compressedFile = null;

// ==========================================
// IMAGE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    beforePreview.src = URL.createObjectURL(selectedFile);

    originalSize.textContent = formatFileSize(selectedFile.size);

});

// ==========================================
// COMPRESS IMAGE
// ==========================================

compressBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Please select an image first.");

        return;

    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";

    try {

        const quality = Number(qualitySlider.value) / 100;

        if (quality === 1.0) {
            // 100% quality means keep original image
            compressedFile = selectedFile;
        } else {
            const targetSizeMB = (selectedFile.size / (1024 * 1024)) * quality;
            const options = {
                maxSizeMB: Math.max(0.01, targetSizeMB),
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: quality,
                alwaysKeepResolution: true
            };

            compressedFile = await imageCompression(selectedFile, options);

            // Fallback to original if compressed version is somehow larger
            if (compressedFile.size >= selectedFile.size) {
                compressedFile = selectedFile;
            }
        }

        afterPreview.src = URL.createObjectURL(compressedFile);
        compressedSize.textContent = formatFileSize(compressedFile.size);

        const saved = calculateSavedPercentage(selectedFile.size, compressedFile.size);
        savedPercent.textContent = saved + "%";

        // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Show Result Card
        const resultCard = document.getElementById("resultCard");
        if (resultCard) {
            resultCard.style.display = "block";
        }

        // Save History (if user is logged in)
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: formatFileSize(selectedFile.size),
                compressedSize: formatFileSize(compressedFile.size),
                saved: saved,
                type: "image",
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()

            });

        }

    } catch (error) {

        console.error(error);

        alert("Failed to compress image.");

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress Image";

    }

});

// ==========================================
// DOWNLOAD COMPRESSED IMAGE
// ==========================================

downloadBtn.addEventListener("click", () => {

    if (!compressedFile) {

        alert("Please compress an image first.");

        return;

    }

    const url = URL.createObjectURL(compressedFile);

    const a = document.createElement("a");

    a.href = url;

    a.download = "compressed-" + selectedFile.name;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);

});

// ==========================================
// DRAG & DROP SUPPORT
// ==========================================

const uploadBox = document.querySelector(".upload-box");

if (uploadBox) {

    uploadBox.addEventListener("dragover", (e) => {

        e.preventDefault();
        uploadBox.classList.add("dragover");

    });

    uploadBox.addEventListener("dragleave", () => {

        uploadBox.classList.remove("dragover");

    });

    uploadBox.addEventListener("drop", (e) => {

        e.preventDefault();

        uploadBox.classList.remove("dragover");

        if (e.dataTransfer.files.length) {

            uploadInput.files = e.dataTransfer.files;
            uploadInput.dispatchEvent(new Event("change"));

        }

    });

}

// ==========================================
// END OF FILE
// ==========================================