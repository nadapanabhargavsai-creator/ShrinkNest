# 🪺 ShrinkNest

<div align="center">

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

**Compress Anything. Store Everything.**

A modern browser-based file compression web application that allows users to compress **PDF, Image, and Video** files while securely storing compression history using **Firebase Authentication** and **Cloud Firestore**.

</div>

---

# 📌 Features

- 📄 PDF Compression
- 🖼️ Image Compression
- 🎥 Video Compression
- 🔐 Firebase Authentication
- 👤 Google Sign-In
- 📊 Dashboard with Compression History
- ☁️ Firestore Database Integration
- 📥 Drag & Drop File Upload
- 📱 Fully Responsive Design
- ✨ Modern Glassmorphism UI
- 🔔 Toast Notifications
- ⚡ Fast Browser-Based Compression
- 🌐 Deployable on GitHub Pages & Netlify

---

# 📂 Project Structure

```text
ShrinkNest/
│
├── index.html
├── login.html
├── signup.html
├── dashboard.html
│
├── tools/
│   ├── pdf-compress.html
│   ├── image-compress.html
│   └── video-compress.html
│
├── css/
│   ├── style.css
│   ├── auth.css
│   ├── dashboard.css
│   └── tools.css
│
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── pdf-compress.js
│   ├── image-compress.js
│   ├── video-compress.js
│   ├── navbar.js
│   ├── toast.js
│   └── utils.js
│
├── assets/
│   ├── favicon/
│   ├── icons/
│   └── images/
│
├── firebase/
│   └── firestore.rules
│
├── README.md
└── .gitignore
```

---

# 🚀 Technologies Used

- HTML5
- CSS3
- JavaScript (ES6 Modules)
- Firebase Authentication
- Cloud Firestore
- PDF-LIB
- Browser Image Compression
- FFmpeg.wasm
- Font Awesome
- Google Fonts (Poppins)

---

# 🔥 Firebase Setup

### 1. Create Firebase Project

Go to Firebase Console and create a new project.

### 2. Enable Authentication

Enable:

- Email/Password
- Google Sign-In

### 3. Create Firestore Database

Choose **Production Mode** or **Test Mode**.

### 4. Replace Firebase Config

Open:

```text
js/firebase-config.js
```

Replace it with your Firebase configuration.

### 5. Deploy Firestore Rules

Use the rules from:

```text
firebase/firestore.rules
```

---

# 📄 Supported Formats

| Tool | Formats |
|------|----------|
| PDF | .pdf |
| Image | .jpg .jpeg .png .webp |
| Video | .mp4 .mov |

---

# 📸 Application Pages

- Home Page
- Login Page
- Signup Page
- Dashboard
- PDF Compressor
- Image Compressor
- Video Compressor

---

# 🎯 Main Functionalities

- User Registration
- User Login
- Google Authentication
- File Upload
- Compression
- Download Compressed File
- Save Compression History
- View Dashboard Statistics
- Responsive Navigation

---

# 🌐 Deployment

The project can be deployed using:

- GitHub Pages
- Netlify
- Firebase Hosting

No backend server is required.

---

# 📦 Libraries Used

- Firebase SDK
- PDF-LIB
- Browser Image Compression
- FFmpeg.wasm
- Font Awesome

---

# 👨‍💻 Developed By

**ShrinkNest Team**

Academic Mini Project

---

# 📜 License

This project is developed for **educational and learning purposes**.

You are free to modify and extend it for personal or academic use.

---

<div align="center">

### ⭐ If you like this project, consider giving it a star on GitHub!

Made with ❤️ using HTML, CSS, JavaScript & Firebase.

</div>