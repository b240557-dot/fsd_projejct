import { Mail, MapPin, Phone } from "lucide-react";

function Contact() {
  return (
    <section className="contact-page">
      <span className="eyebrow">WE’RE HERE TO HELP</span>
      <h1>Get in touch</h1>
      <p className="muted contact-intro">Questions about using the AI Interview Prep project? Find the current project contact details below.</p>

      <div className="contact-grid">
        <article className="content-card contact-card">
          <MapPin size={22} />
          <h2>Office address</h2>
          <p>2nd floor, Sipra Path<br />Vatika, Jaipur, 303905</p>
        </article>
        <article className="content-card contact-card">
          <Mail size={22} />
          <h2>Email</h2>
          <p>lokesh@5748</p>
        </article>
        <article className="content-card contact-card">
          <Phone size={22} />
          <h2>Phone</h2>
          <p>+91-6350569027<br />+91-6377316489</p>
        </article>
      </div>

      <article className="content-card contact-note">
        <h2>About this project</h2>
        <p>The current FastAPI backend supports student registration and login. Contact submissions and interview practice APIs are not configured yet.</p>
      </article>
    </section>
  );
}

export default Contact;
