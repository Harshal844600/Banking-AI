import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — FinSight AI" }] }),
  component: Contact,
});

function Contact() {
  return (
    <div className="min-h-screen bg-background text-foreground px-8 py-20 max-w-4xl mx-auto animate-reveal">
      <nav className="flex items-center justify-between mb-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-foreground flex items-center justify-center text-background font-display font-black text-xl italic">
            F
          </div>
          <span className="font-display font-bold tracking-tight text-xl">FinSight AI</span>
        </Link>
        <div>
          <Link to="/" className="text-sm font-medium hover:text-accent">
            Home
          </Link>
        </div>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold">Contact Us</h1>
        <p className="text-muted-foreground mt-2">
          Questions, feedback, or partnership inquiries — reach out below.
        </p>
      </header>

      <section className="bg-secondary border border-border p-8 rounded-md">
        <h2 className="font-bold mb-4">Get in touch</h2>
        <div className="space-y-3 text-sm">
          <div>
            <strong>Name:</strong> Harshal Vidhate
          </div>
          <div>
            <strong>Email:</strong>{" "}
            <a href="mailto:harshal91@gmailcom" className="text-accent underline">
              harshal91@gmailcom
            </a>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Please use this email for inquiries; consider updating to a valid address if needed.
          </div>
        </div>
      </section>
    </div>
  );
}

export default Contact;
