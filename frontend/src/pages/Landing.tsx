import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Code2,
  GitBranch,
  History,
  ShieldCheck,
} from 'lucide-react';
import './landing.css';

const features = [
  {
    icon: BookOpen,
    title: 'A shared metric dictionary',
    text: 'Keep the meaning, calculation, business domain and responsible people together. Search the catalogue before creating another definition.',
  },
  {
    icon: Code2,
    title: 'Clearer SQL reviews',
    text: 'Check SELECT syntax and compare two SQL definitions to spot changes that may affect a calculation.',
  },
  {
    icon: GitBranch,
    title: 'Understand what depends on what',
    text: 'See how metrics connect and which dependent definitions could be affected before you make a change.',
  },
  {
    icon: History,
    title: 'A history you can follow',
    text: 'Review saved versions, change notes and audit events to understand how a definition evolved.',
  },
];
const faqs = [
  [
    'What is RicozMetrics?',
    'RicozMetrics is a shared catalogue of business metrics. It records what each metric means, how it is calculated, who maintains it and how it changes over time.',
  ],
  [
    'Who is it for?',
    'Business teams can find and understand definitions. Analysts can document and check SQL. Data stewards can maintain the catalogue, review changes and manage the metric lifecycle.',
  ],
  [
    'Does it calculate revenue or run reports?',
    'No. The workspace stores metric definitions and checks SQL without running it against a warehouse. It does not display live business results or replace your reporting tool.',
  ],
  [
    'How do I get started?',
    'Open the workspace, browse the metric catalogue and check whether your definition already exists. To add one, choose Create metric and enter its business meaning, SQL, domain and responsible people.',
  ],
  [
    'What does Certified mean?',
    'Certified is a lifecycle status for an agreed definition. Its calculation is frozen to help prevent accidental changes. It is not an independent verification of the underlying data.',
  ],
  [
    'Can anyone open the workspace?',
    'This version is intended for a protected internal environment. Sign-in and role-based permissions are not implemented. Access protection must be provided by your deployment before using it with company data.',
  ],
];

export default function Landing() {
  return (
    <div className="landing-page">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="lp-header">
        <Link className="lp-brand" to="/" aria-label="RicozMetrics home">
          <span className="lp-mark">rZ</span>
          <span>
            Ricoz<span className="lp-brand-light">Metrics</span>
          </span>
        </Link>
        <nav aria-label="Product navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">FAQs</a>
        </nav>
        <Link className="lp-button lp-primary" to="/overview">
          Open workspace <ArrowUpRight size={17} />
        </Link>
      </header>
      <main id="landing-main" className="lp-main">
        <section className="lp-hero lp-container">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">THE SHARED LANGUAGE OF YOUR BUSINESS</p>
            <h1>
              Every metric.
              <br />
              One clear <span>meaning.</span>
            </h1>
            <p className="lp-intro">
              Bring your business definitions, SQL and change history into one place. Give your team
              a shared understanding of the numbers they work with.
            </p>
            <div className="lp-actions">
              <Link className="lp-button lp-primary" to="/overview">
                Open workspace <ArrowRight size={18} />
              </Link>
              <a className="lp-text-link" href="#how-it-works">
                See how it works <ArrowRight size={17} />
              </a>
            </div>
            <p className="lp-hero-note">
              <Check size={16} /> Built for analysts, business teams and data stewards
            </p>
          </div>
          <div className="lp-preview" aria-label="Illustrative metric definition">
            <div className="lp-preview-top">
              <span>
                <BookOpen size={15} /> Metric catalogue
              </span>
              <span>ILLUSTRATIVE EXAMPLE</span>
            </div>
            <div className="lp-definition">
              <div className="lp-definition-label">
                <span>FINANCE / METRIC DEFINITION</span>
                <span className="lp-draft">Draft</span>
              </div>
              <h2>Total order value</h2>
              <p>The sum of order amounts recorded in the orders table.</p>
              <div className="lp-metadata">
                <span>
                  Metric key<strong>total_order_value</strong>
                </span>
                <span>
                  Data steward<strong>Finance team</strong>
                </span>
              </div>
            </div>
            <div className="lp-code">
              <span>
                <Code2 size={15} /> THE CALCULATION
              </span>
              <pre>
                <code>
                  <b>SELECT</b> SUM(amount)
                  <br /> <b>AS</b> total_order_value
                  <br />
                  <b>FROM</b> orders
                </code>
              </pre>
            </div>
            <div className="lp-preview-bottom">
              <History size={17} />
              <span>
                Definition + calculation + history<strong>Context stays with the metric.</strong>
              </span>
            </div>
          </div>
        </section>
        <div className="lp-principles">
          <div className="lp-container">
            <span>One place for the full picture</span>
            <strong>
              <BookOpen size={18} /> Business meaning
            </strong>
            <strong>
              <Code2 size={18} /> SQL definitions
            </strong>
            <strong>
              <GitBranch size={18} /> Dependencies
            </strong>
            <strong>
              <History size={18} /> Change history
            </strong>
          </div>
        </div>
        <section id="features" className="lp-section lp-container">
          <div className="lp-section-heading">
            <p className="lp-eyebrow">CLARITY AT EVERY STEP</p>
            <h2>
              Less time asking what a metric means. <br />
              More context to work with.
            </h2>
            <p>
              A definition is useful when everyone can find it, understand it and see what changed.
            </p>
          </div>
          <div className="lp-features">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="lp-feature-icon">
                  <Icon size={25} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="lp-process">
          <div className="lp-container lp-process-grid">
            <div>
              <p className="lp-eyebrow">FROM DEFINITION TO SHARED UNDERSTANDING</p>
              <h2>
                A simple workflow.
                <br />A clearer catalogue.
              </h2>
              <p>
                Start with the meaning. Add the calculation. Keep a record as your business evolves.
              </p>
              <Link className="lp-text-link" to="/metrics">
                Explore the metric catalogue <ArrowRight size={18} />
              </Link>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>Find or define a metric</h3>
                  <p>
                    Search first. Add a clear name, business description, domain, SQL and
                    responsible people when a new definition is needed.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Check the calculation and connections</h3>
                  <p>
                    Validate SQL syntax, review referenced metrics and inspect the possible impact
                    of a change.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Maintain it with a clear record</h3>
                  <p>
                    Move through Draft, Certified and Archived states. Review versions and audit
                    events as definitions change.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <section className="lp-section lp-container lp-purpose">
          <ShieldCheck size={38} />
          <div>
            <p className="lp-eyebrow">BUILT AROUND THE DEFINITION</p>
            <h2>Know the meaning behind the number.</h2>
            <p>
              RicozMetrics documents and checks your metric definitions. Your reporting tools
              continue to calculate and display business results. Together, they help your team
              connect a number to the logic behind it.
            </p>
          </div>
        </section>
        <section id="questions" className="lp-faq lp-container">
          <div>
            <p className="lp-eyebrow">A FEW USEFUL ANSWERS</p>
            <h2>
              Frequently asked <br />
              questions.
            </h2>
            <p>Get to know the workspace before you begin.</p>
          </div>
          <div className="lp-faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="lp-cta">
          <div className="lp-container">
            <div>
              <p className="lp-eyebrow">GIVE YOUR TEAM A SHARED STARTING POINT</p>
              <h2>
                Make your metrics
                <br />
                easier to understand.
              </h2>
              <p>Your definitions, connections and history. Together.</p>
            </div>
            <Link className="lp-button" to="/overview">
              Open workspace <ArrowRight size={19} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="lp-footer lp-container">
        <div>
          <Link className="lp-brand" to="/">
            <span className="lp-mark">rZ</span>
            <span>
              Ricoz<span className="lp-brand-light">Metrics</span>
            </span>
          </Link>
          <p>Definitions you can trace.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/metrics">Metric catalogue</Link>
          <Link to="/sql">SQL workbench</Link>
          <a href="https://ricoz.in/franchise/" target="_blank" rel="noopener noreferrer">
            About Ricoz <ArrowUpRight size={14} />
          </a>
        </nav>
        <span className="lp-footer-caption">METRIC CATALOGUE & GOVERNANCE</span>
      </footer>
    </div>
  );
}
