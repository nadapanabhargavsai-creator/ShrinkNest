// ==========================================
// SHRINKNEST DASHBOARD
// File: js/dashboard.js
// ==========================================

import { db, auth } from "./firebase-config.js";

import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ==========================================
// LOAD DASHBOARD
// ==========================================

export async function loadDashboard() {

    onAuthStateChanged(auth, async (user) => {

        if (!user) return;

        const historyBody =
            document.getElementById("historyBody");

        const emptyState =
            document.getElementById("emptyState");

        historyBody.innerHTML = "";

        try {

            const historyRef = collection(db, "history");

            const q = query(
                historyRef,
                where("uid", "==", user.uid),
                orderBy("date", "desc")
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {

                emptyState.style.display = "block";

                return;

            }

            emptyState.style.display = "none";

            snapshot.forEach((doc) => {

                const item = doc.data();

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${item.filename}</td>
                    <td>${item.originalSize}</td>
                    <td>${item.compressedSize}</td>
                    <td>${item.saved}%</td>
                    <td>${item.date}</td>
                    <td>
                        <span class="badge badge-${item.type}">
                            ${item.type.toUpperCase()}
                        </span>
                    </td>
                `;

                historyBody.appendChild(row);

            });

        } catch (error) {

            console.error("Dashboard Error:", error);

        }

    });

}
// ==========================================
// FORMAT FILE SIZE
// ==========================================

export function formatFileSize(bytes) {

    if (bytes < 1024) return bytes + " B";

    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(2) + " KB";

    if (bytes < 1024 * 1024 * 1024)
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";

    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";

}

// ==========================================
// REFRESH HISTORY
// ==========================================

export function refreshDashboard() {

    loadDashboard();

}

// ==========================================
// CLEAR TABLE
// ==========================================

export function clearDashboardTable() {

    const body = document.getElementById("historyBody");

    if (body) {

        body.innerHTML = "";

    }

}

// ==========================================
// DASHBOARD INITIALIZER
// ==========================================

export function initializeDashboard() {

    loadDashboard();

}

// ==========================================
// AUTO INITIALIZE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initializeDashboard();

});

// ==========================================
// END OF FILE
// ==========================================