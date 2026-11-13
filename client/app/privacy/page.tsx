import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FiShield, FiLock, FiCheckCircle, FiDatabase, FiFileText } from "react-icons/fi";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rocky.legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Rocky Legal",
  description:
    "Learn about Rocky Legal's strict data privacy standards, DPDP Act 2023 compliance, and zero-training guarantee for legal research.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Rocky Legal",
    description:
      "Our commitment to confidentiality and data protection for advocates and legal professionals. Zero model training on client queries.",
    url: `${siteUrl}/privacy`,
    siteName: "Rocky Legal",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0C0A09] text-[#1A1614] dark:text-[#E8E0D4] transition-colors duration-500">
      <Navbar />

      <main className="flex-1 pt-32 pb-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-[#1A1614]/10 dark:border-[#2A2522] pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C7A064]/10 border border-[#C7A064]/20 text-[#C7A064] text-xs font-semibold tracking-wider uppercase">
              <FiShield className="w-3.5 h-3.5" /> Confidentiality & Data Protection
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-[#5A5550] dark:text-[#8A8279] text-sm">
              Effective Date: November 2026 • Compliant with DPDP Act, 2023 & IT Act, 2000
            </p>
          </div>

          {/* Critical Callout: Zero Model Training Guarantee */}
          <div className="p-6 sm:p-8 rounded-2xl bg-amber-500/5 dark:bg-[#1A1614]/60 border border-[#C7A064]/30 space-y-3">
            <div className="flex items-center gap-2.5 text-[#C7A064] font-semibold text-lg">
              <FiLock className="w-5 h-5 shrink-0" />
              <span>Zero-Training Guarantee for Legal Research</span>
            </div>
            <p className="text-[#5A5550] dark:text-[#8A8279] text-sm sm:text-base leading-relaxed">
              We understand that legal research often involves sensitive client matters, case facts,
              and confidential theories. <strong className="text-[#1A1614] dark:text-[#E8E0D4]">Rocky Legal never uses your private queries, research history, or case notes to train, retrain, or fine-tune public foundation AI models.</strong> Your searches remain private to your authenticated account.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">1.</span> Introduction & Scope
            </h2>
            <p className="text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
              Rocky Legal (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the AI-assisted legal research platform accessible at{" "}
              <a href="https://rocky.legal" className="text-[#C7A064] underline underline-offset-4">https://rocky.legal</a>.
              This Privacy Policy explains how we collect, store, protect, and handle your information in strict adherence to the{" "}
              <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and the{" "}
              <strong>Information Technology Act, 2000</strong> (including the Reasonable Security Practices and Procedures and Sensitive Personal Data or Information Rules, 2011).
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">2.</span> Information We Collect
            </h2>
            <div className="space-y-4 text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
              <div className="p-4 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522]">
                <h3 className="font-semibold text-[#1A1614] dark:text-[#E8E0D4] mb-1">
                  A. Account & Identity Information
                </h3>
                <p className="text-sm">
                  When you register or log in (via Google OAuth or email OTP), we collect your name, email address, and profile picture provided by your authentication provider.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522]">
                <h3 className="font-semibold text-[#1A1614] dark:text-[#E8E0D4] mb-1">
                  B. Legal Research Inputs & Chat History
                </h3>
                <p className="text-sm">
                  We store your search prompts, citations inquiries, and chat conversation threads. This is done exclusively to enable your personal research history across devices so you can reference previous queries.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522]">
                <h3 className="font-semibold text-[#1A1614] dark:text-[#E8E0D4] mb-1">
                  C. Technical & Diagnostic Telemetry
                </h3>
                <p className="text-sm">
                  We collect anonymized technical details such as browser user agent, IP address, and platform response latency to monitor service availability and prevent abusive automation.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">3.</span> How AI & Retrieval-Augmented Generation (RAG) Operates
            </h2>
            <div className="space-y-3 text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
              <p>
                Our platform utilizes Retrieval-Augmented Generation (RAG) to provide grounded legal synthesis. Here is exactly how your queries are handled:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>
                  <strong>Semantic Vector Search:</strong> When you enter a query, our dedicated embedding microservice converts your text into mathematical vectors to locate matching sections of bare acts and court rulings in an isolated vector index.
                </li>
                <li>
                  <strong>Synthesized Context:</strong> Only the matched public legal excerpts and your immediate question are sent to the large language model to synthesize the final citation-backed answer.
                </li>
                <li>
                  <strong>Workspace Isolation:</strong> Your queries and research threads are cryptographically associated solely with your user identifier. There is zero data bleed between users or organizations.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">4.</span> Data Security & Encryption
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-[#5A5550] dark:text-[#8A8279]">
              <div className="p-4 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522] space-y-2">
                <div className="flex items-center gap-2 text-[#C7A064] font-semibold">
                  <FiLock className="w-4 h-4" /> TLS 1.3 In Transit
                </div>
                <p>
                  All data exchanged between your browser and our servers is encrypted using modern TLS 1.3 cryptographic protocols.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522] space-y-2">
                <div className="flex items-center gap-2 text-[#C7A064] font-semibold">
                  <FiDatabase className="w-4 h-4" /> AES-256 At Rest
                </div>
                <p>
                  Databases and vector storage systems are stored in encrypted volumes protected by industry-standard AES-256 bit encryption.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">5.</span> User Control & Right to Erasure
            </h2>
            <p className="text-[#5A5550] dark:text-[#8A8279] leading-relaxed">
              Under the DPDP Act, 2023, you retain full sovereignty over your personal data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-[#5A5550] dark:text-[#8A8279]">
              <li>
                <strong>Delete Chat History:</strong> You can delete any individual chat thread directly from the research sidebar at any time. Deletion immediately removes the thread from our primary database.
              </li>
              <li>
                <strong>Full Account Deletion:</strong> You may request complete erasure of your account, authentication tokens, and all associated research logs by contacting our privacy team.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">6.</span> Third-Party Service Providers
            </h2>
            <p className="text-[#5A5550] dark:text-[#8A8279] leading-relaxed text-sm">
              We rely on trusted enterprise infrastructure providers to deliver our services, including cloud hosting (Vercel, enterprise VPS), database hosting (MongoDB Atlas), and enterprise LLM inference APIs with zero-retention data privacy guarantees. All providers are contractually bound to maintain strict confidentiality and data protection standards.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[#1A1614] dark:text-[#E8E0D4]">
              <span className="text-[#C7A064]">7.</span> Grievance Officer & Contact Information
            </h2>
            <p className="text-[#5A5550] dark:text-[#8A8279] leading-relaxed text-sm">
              In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, the details of our Grievance Officer are provided below:
            </p>
            <div className="p-5 rounded-xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522] space-y-1.5 text-sm">
              <p className="font-semibold text-[#1A1614] dark:text-[#E8E0D4]">Privacy & Grievance Officer</p>
              <p className="text-[#5A5550] dark:text-[#8A8279]">Rocky Legal Data Governance Team</p>
              <p className="text-[#5A5550] dark:text-[#8A8279]">
                Email:{" "}
                <a href="mailto:privacy@rocky.legal" className="text-[#C7A064] underline underline-offset-4">
                  privacy@rocky.legal
                </a>{" "}
                /{" "}
                <a href="mailto:info@rocky.legal" className="text-[#C7A064] underline underline-offset-4">
                  info@rocky.legal
                </a>
              </p>
              <p className="text-[#5A5550] dark:text-[#8A8279]">Location: India</p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

