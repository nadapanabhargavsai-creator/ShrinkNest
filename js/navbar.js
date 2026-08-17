// ==========================================
// SHRINKNEST NAVBAR
// File: js/navbar.js
// ==========================================

import { auth, db } from "./firebase-config.js";
import { logout } from "./auth.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    const menuBtn = document.querySelector(".hamburger");
    const navLinks = document.querySelector(".nav-links");

    // Mobile Menu Toggle
    if (menuBtn && navLinks) {
        menuBtn.addEventListener("click", () => {
            navLinks.classList.toggle("active");
            menuBtn.classList.toggle("active");
        });
    }

    // Navbar Auth Buttons
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const loginNavItem = document.getElementById("loginNavItem");
    const signupNavItem = document.getElementById("signupNavItem");
    const profileNavItem = document.getElementById("profileNavItem");
    const logoutNavItem = document.getElementById("logoutNavItem");
    const navUserName = document.getElementById("navUserName");
    const navUserPhoto = document.getElementById("navUserPhoto");
    const logoutBtn = document.getElementById("logoutBtn");

    const defaultAvatar = "assets/images/default-avatar.svg";

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (loginBtn) loginBtn.style.display = "none";
            if (signupBtn) signupBtn.style.display = "none";
            if (loginNavItem) loginNavItem.style.display = "none";
            if (signupNavItem) signupNavItem.style.display = "none";

            if (profileNavItem) {
                profileNavItem.style.display = "inline-flex";
            }
            if (logoutNavItem) {
                logoutNavItem.style.display = "inline-flex";
            }
            if (logoutBtn) {
                logoutBtn.style.display = "inline-flex";
            }

            let name = user.displayName || "Account";
            let photo = user.photoURL || defaultAvatar;

            if (navUserName) {
                const firstName = name.trim().split(/\s+/)[0];
                navUserName.textContent = firstName ? firstName : "Account";
            }

            if (navUserPhoto) {
                navUserPhoto.setAttribute("referrerpolicy", "no-referrer");
                navUserPhoto.src = photo;
                navUserPhoto.onerror = function() {
                    this.onerror = null;
                    this.src = defaultAvatar;
                };
            }

            // Check Firestore for custom profile photo
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists() && snap.data().photoURL) {
                    if (navUserPhoto) navUserPhoto.src = snap.data().photoURL;
                }
            } catch (err) {
                console.warn("Could not fetch user photo from Firestore:", err);
            }

        } else {
            if (loginBtn) loginBtn.style.display = "inline-flex";
            if (signupBtn) signupBtn.style.display = "inline-flex";
            if (loginNavItem) loginNavItem.style.display = "inline-flex";
            if (signupNavItem) signupNavItem.style.display = "inline-flex";
            if (profileNavItem) profileNavItem.style.display = "none";
            if (logoutNavItem) logoutNavItem.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "none";
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await logout();
        });
    }

});
