// ==========================================
// SHRINKNEST PDF COMPRESSOR
// File: js/pdf-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const uploadInput = document.getElementById("pdfFile");
const compressBtn = document.getElementById("compressBtn");
const levelSelect = document.getElementById("compressionLevel");

const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

const downloadBtn = document.getElementById("downloadBtn");

let selectedFile = null;
let compressedBlob = null;

// ==========================================
// FILE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    fileName.textContent = selectedFile.name;

    originalSize.textContent =
        (selectedFile.size / 1024).toFixed(2) + " KB";

});

// ==========================================
// PDF COMPRESS
// ==========================================

compressBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Please select a PDF file.");

        return;

    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";

    try {

        const arrayBuffer =
            await selectedFile.arrayBuffer();

        const pdfDoc =
            await PDFLib.PDFDocument.load(arrayBuffer);

        const pdfBytes =
            await pdfDoc.save({
                useObjectStreams: true
            });

        compressedBlob = new Blob(
            [pdfBytes],
            { type: "application/pdf" }
        );

        const newSize =
            compressedBlob.size;

        compressedSize.textContent =
            (newSize / 1024).toFixed(2) + " KB";

        const saved =
            (
                ((selectedFile.size - newSize) /
                    selectedFile.size) *
                100
            ).toFixed(1);

        savedPercent.textContent = saved + "%";
                // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Save History (if logged in)
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: (selectedFile.size / 1024).toFixed(2) + " KB",
                compressedSize: (newSize / 1024).toFixed(2) + " KB",
                saved: saved,
                type: "pdf",
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()

            });

        }

    } catch (error) {

        console.error(error);

        alert("Failed to compress PDF.");

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress PDF";

    }

});

// ==========================================
// DOWNLOAD
// ==========================================

downloadBtn.addEventListener("click", () => {

    if (!compressedBlob) {

        alert("Please compress the PDF first.");

        return;

    }

    const url = URL.createObjectURL(compressedBlob);

    const a = document.createElement("a");

    a.href = url;

    a.download = selectedFile.name.replace(
        ".pdf",
        "-compressed.pdf"
    );

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