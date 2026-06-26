// ==========================================
// ShrinkNest Authentication
// File: js/auth.js
// ==========================================

import {
    auth,
    db,
    provider
} from "./firebase-config.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    signOut,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// ==========================================
// SIGN UP
// ==========================================

export async function signup(name, email, password) {

    try {

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        await updateProfile(user, {
            displayName: name
        });

        await setDoc(doc(db, "users", user.uid), {

            uid: user.uid,
            name: name,
            email: email,
            photoURL: user.photoURL || "",
            createdAt: new Date().toISOString()

        });

        return {
            success: true,
            message: "Account created successfully."
        };

    } catch (error) {

        return {

            success: false,
            message: error.message

        };

    }

}

// ==========================================
// LOGIN
// ==========================================

export async function login(email, password) {

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        return {

            success: true,
            message: "Login successful."

        };

    } catch (error) {

        return {

            success: false,
            message: error.message

        };

    }

}

// ==========================================
// GOOGLE LOGIN
// ==========================================

export async function googleLogin() {

    try {

        const result = await signInWithPopup(
            auth,
            provider
        );

        const user = result.user;

        const userRef = doc(db, "users", user.uid);

        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {

            await setDoc(userRef, {

                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString()

            });

        }

        return {

            success: true,
            message: "Google login successful."

        };

    } catch (error) {

        return {

            success: false,
            message: error.message

        };

    }

}
// ==========================================
// FORGOT PASSWORD
// ==========================================

export async function forgotPassword(email) {

    try {

        await sendPasswordResetEmail(auth, email);

        return {

            success: true,
            message: "Password reset email sent successfully."

        };

    } catch (error) {

        return {

            success: false,
            message: error.message

        };

    }

}

// ==========================================
// LOGOUT
// ==========================================

export async function logout() {

    try {

        await signOut(auth);

        window.location.href = "../index.html";

    } catch (error) {

        console.error(error);

    }

}

// ==========================================
// AUTH STATE LISTENER
// ==========================================

export function observeAuth(callback) {

    onAuthStateChanged(auth, async (user) => {

        if (user) {

            const userRef = doc(db, "users", user.uid);

            const snap = await getDoc(userRef);

            let userData = {};

            if (snap.exists()) {

                userData = snap.data();

            }

            callback({

                loggedIn: true,
                user: user,
                profile: userData

            });

        } else {

            callback({

                loggedIn: false,
                user: null,
                profile: null

            });

        }

    });

}

// ==========================================
// PROTECTED PAGE CHECK
// ==========================================

export function protectPage() {

    onAuthStateChanged(auth, (user) => {

        if (!user) {

            window.location.href = "../login.html";

        }

    });

}

// ==========================================
// GET CURRENT USER
// ==========================================

export function getCurrentUser() {

    return auth.currentUser;

}
// ==========================================
// EMAIL VALIDATION
// ==========================================

export function validateEmail(email) {

    const regex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return regex.test(email);

}

// ==========================================
// PASSWORD STRENGTH
// ==========================================

export function checkPasswordStrength(password) {

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {

        return {
            score,
            label: "Weak",
            color: "#ff4d4f"
        };

    }

    if (score === 3 || score === 4) {

        return {
            score,
            label: "Medium",
            color: "#faad14"
        };

    }

    return {
        score,
        label: "Strong",
        color: "#52c41a"
    };

}

// ==========================================
// FORM VALIDATION
// ==========================================

export function validateSignupForm(data) {

    const errors = {};

    if (!data.name || data.name.trim().length < 3) {

        errors.name = "Name must contain at least 3 characters.";

    }

    if (!validateEmail(data.email)) {

        errors.email = "Please enter a valid email address.";

    }

    if (data.password.length < 8) {

        errors.password =
            "Password must be at least 8 characters.";

    }

    if (data.password !== data.confirmPassword) {

        errors.confirmPassword =
            "Passwords do not match.";

    }

    return {

        valid: Object.keys(errors).length === 0,
        errors

    };

}

export function validateLoginForm(data) {

    const errors = {};

    if (!validateEmail(data.email)) {

        errors.email = "Invalid email address.";

    }

    if (!data.password) {

        errors.password = "Password is required.";

    }

    return {

        valid: Object.keys(errors).length === 0,
        errors

    };

}

// ==========================================
// NAVBAR AUTH BUTTONS
// ==========================================

export function updateNavbarAuth() {

    const loginBtn =
        document.getElementById("loginBtn");

    const signupBtn =
        document.getElementById("signupBtn");

    const dashboardBtn =
        document.getElementById("dashboardBtn");

    onAuthStateChanged(auth, (user) => {

        if (user) {

            if (loginBtn) loginBtn.style.display = "none";
            if (signupBtn) signupBtn.style.display = "none";

            if (dashboardBtn) {

                dashboardBtn.style.display = "inline-flex";

            }

        } else {

            if (loginBtn) loginBtn.style.display = "inline-flex";
            if (signupBtn) signupBtn.style.display = "inline-flex";

            if (dashboardBtn) {

                dashboardBtn.style.display = "none";

            }

        }

    });

}
// ==========================================
// DISPLAY USER INFO
// ==========================================

export function displayUserInfo() {

    onAuthStateChanged(auth, (user) => {

        if (!user) return;

        const nameElement = document.getElementById("userName");
        const photoElement = document.getElementById("userPhoto");

        if (nameElement) {

            nameElement.textContent =
                user.displayName || "User";

        }

        if (photoElement) {

            photoElement.src =
                user.photoURL ||
                "assets/images/default-avatar.png";

            photoElement.alt =
                user.displayName || "User";

        }

    });

}

// ==========================================
// REDIRECT IF ALREADY LOGGED IN
// ==========================================

export function redirectIfLoggedIn() {

    onAuthStateChanged(auth, (user) => {

        if (user) {

            window.location.href = "dashboard.html";

        }

    });

}

// ==========================================
// INITIALIZE AUTH
// ==========================================

export function initializeAuth() {

    updateNavbarAuth();

}

// ==========================================
// GLOBAL HELPERS (OPTIONAL)
// ==========================================

window.ShrinkNestAuth = {

    signup,
    login,
    googleLogin,
    forgotPassword,
    logout,
    observeAuth,
    protectPage,
    getCurrentUser,
    validateEmail,
    validateSignupForm,
    validateLoginForm,
    checkPasswordStrength,
    updateNavbarAuth,
    displayUserInfo,
    redirectIfLoggedIn,
    initializeAuth

};

// ==========================================
// AUTO INITIALIZE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initializeAuth();

});

// ==========================================
// END OF FILE
// ==========================================