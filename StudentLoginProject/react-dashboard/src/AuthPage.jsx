import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import hero from "./assets/hero.png";
import { validateRegistration } from "./style3";
import { useAuth } from "./useAuth";

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());

    if (isSignup) {
      const validationError = validateRegistration(values);
      if (validationError) {
        setIsError(true);
        setMessage(validationError);
        return;
      }
    }

    delete values.confirmPassword;
    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signup(values);
      } else {
        await login(values);
      }
      if (isSignup) {
        setMessage("Your account was created. You can now log in.");
        form.reset();
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (user && !isSignup) navigate("/dashboard", { replace: true });
  }, [user, isSignup, navigate]);

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link className="brand auth-brand" to="/dashboard">
          <span className="brand-mark">AI</span>
          <span>Interview<span className="brand-accent">Prep</span></span>
        </Link>
        <div className="auth-art">
          <img src={hero} alt="" />
          <span className="eyebrow">YOUR NEXT OPPORTUNITY STARTS HERE</span>
          <h1>Build confidence for your next interview.</h1>
          <p>Practice, learn, and take your next career step with confidence.</p>
        </div>
        <span className="visual-footnote">AI Interview Prep</span>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">{isSignup ? "GET STARTED" : "WELCOME BACK"}</span>
          <h2>{isSignup ? "Create your account" : "Log in to your account"}</h2>
          <p className="muted">{isSignup ? "Sign up to get started with your interview preparation." : "Enter your details to continue to your dashboard."}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <div className="form-grid">
                <label>First name<input name="fname" autoComplete="given-name" required /></label>
                <label>Last name<input name="lname" autoComplete="family-name" required /></label>
              </div>
            )}
            <label>Username<input name="username" autoComplete="username" required /></label>
            {isSignup && (
              <>
                <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
                <label>Contact number<input type="tel" name="contact" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" required /></label>
              </>
            )}
            <label>Password<input type="password" name="password" autoComplete={isSignup ? "new-password" : "current-password"} required /></label>
            {isSignup && <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" required /></label>}

            {message && <p className={isError ? "form-message error" : "form-message success"} role="status">{message}</p>}

            <button className="primary-btn auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Log in"}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Sign up"}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;
