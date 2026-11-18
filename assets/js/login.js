import { signInWithPopup } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { auth, googleProvider } from "./firebase.js";

const button = document.getElementById("googleSignIn");
const message = document.getElementById("loginMessage");

button?.addEventListener("click", async () => {
  button.disabled = true;
  message.textContent = "Opening Google sign-in…";
  try {
    await signInWithPopup(auth, googleProvider);
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);
    message.textContent = error.code === "auth/unauthorized-domain"
      ? "This website domain is not authorized in Firebase Authentication."
      : (error.message || "Sign-in failed. Please try again.");
    button.disabled = false;
  }
});
