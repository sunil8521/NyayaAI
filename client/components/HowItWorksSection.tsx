"use client";

import {
  FiUsers,
  FiBookOpen,
  FiSearch,
  FiAward,
  FiShield,
  FiCheckCircle,
  FiLayers,
} from "react-icons/fi";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const principles = [
  {
    icon: FiCheckCircle,
    title: "Grounded in Real Jurisprudence",
    desc: "General AI tools often hallucinate precedents and invent citations. Rocky Legal uses Retrieval-Augmented Generation (RAG) to anchor every answer directly in indexed Supreme Court judgments, High Court rulings, and statutory bare acts.",
  },
  {
    icon: FiLayers,
    title: "Traceable Citations & Statutes",
    desc: "Every response provides direct references to specific sections, acts, and reported judgments—including transitions to the Bharatiya Nyaya Sanhita (BNS), BNSS, and BSA—so advocates can verify every point before filing.",
  },
  {
    icon: FiShield,
    title: "Client Privilege & Confidentiality",
    desc: "Your research queries and case theories remain strictly confidential. We never use your searches, prompts, or client matters to train public foundation models. Your data remains isolated and encrypted.",
  },
];

const audiences = [
  {
    icon: FiUsers,
    label: "Advocates & Counsel",
    desc: "Quickly locate relevant precedents, cross-reference statutory changes, and prepare hearing notes in minutes.",
  },
  {
    icon: FiBookOpen,
    label: "Law Firms & Teams",
    desc: "Standardize preliminary research, accelerate case diligence, and ensure citation accuracy across litigation teams.",
  },
  {
    icon: FiSearch,
    label: "Legal Researchers",
    desc: "Analyze constitutional interpretations, track judicial trends, and explore comparative jurisprudence efficiently.",
  },
  {
    icon: FiAward,
    label: "Students & Interns",
    desc: "Understand complex legal principles, prepare for moot courts, and study the new criminal law reforms with clarity.",
  },
];

export default function HowItWorksSection() {
  const { ref, isVisible } = useScrollReveal(0.15);

  return (
    <section
      id="about"
      className="relative bg-[#FAFAFA] dark:bg-[#0C0A09] border-t border-[#1A1614]/5 dark:border-[#1A1614] py-24 lg:py-32 transition-colors duration-500 overflow-hidden"
    >
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/nyayaa_scales_of_justice.png"
          alt=""
          className="absolute -bottom-8 sm:-bottom-12 md:-bottom-16 lg:-bottom-20 right-0 sm:right-4 md:right-8 lg:right-auto lg:left-0 w-36 h-52 sm:w-56 sm:h-72 md:w-64 md:h-88 lg:w-[300px] lg:h-[480px] object-contain opacity-[0.06] sm:opacity-[0.08] dark:opacity-[0.05] dark:invert dark:brightness-50 transition-all duration-300 pointer-events-none"
        />
      </div>

      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div
          className={`max-w-3xl mb-16 lg:mb-20 space-y-4 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="text-[#C7A064] font-bold tracking-[0.15em] uppercase text-xs md:text-sm flex items-center gap-3">
            <span className="w-8 h-px bg-[#C7A064]"></span> About Rocky Legal
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl text-[#1A1614] dark:text-[#E8E0D4] font-bold tracking-tight leading-[1.2]">
            Legal research grounded in jurisprudence.{" "}
            <span className="font-heading font-normal italic text-[#C7A064] block sm:inline">
              Not generative guesswork.
            </span>
          </h2>
          <p className="text-[#5A5550] dark:text-[#8A8279] text-base sm:text-lg leading-relaxed pt-2">
            In the courtroom, unverified citations and hallucinated precedents are a liability.
            Rocky Legal is built specifically for Indian law—combining dense semantic retrieval
            with verified statutory corpora and landmark judgments. Designed as an intelligent
            copilot to accelerate preliminary research, not to replace the advocate’s professional
            discernment.
          </p>
        </div>

        {/* Core Principles Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 mb-20 lg:mb-28">
          {principles.map((item, idx) => (
            <div
              key={item.title}
              className={`p-7 rounded-2xl bg-white dark:bg-[#141210] border border-[#1A1614]/5 dark:border-[#2A2522] shadow-sm hover:shadow-md transition-all duration-500 space-y-4 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: isVisible ? `${150 + idx * 120}ms` : "0ms" }}
            >
              <div className="w-12 h-12 rounded-xl bg-[#C7A064]/10 dark:bg-[#C7A064]/15 flex items-center justify-center text-[#C7A064]">
                <item.icon className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="text-[#1A1614] dark:text-[#E8E0D4] font-bold text-xl">
                {item.title}
              </h3>
              <p className="text-[#5A5550] dark:text-[#8A8279] text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Audience Subheading */}
        <div
          className={`space-y-3 mb-12 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ transitionDelay: isVisible ? "450ms" : "0ms" }}
        >
          <p className="text-[#C7A064] font-semibold text-xs uppercase tracking-wider">
            Targeted Audience
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold text-[#1A1614] dark:text-[#E8E0D4]">
            Built for India’s legal fraternity
          </h3>
        </div>

        {/* Audience Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {audiences.map((item, idx) => (
            <div
              key={item.label}
              className={`p-6 rounded-2xl bg-white/60 dark:bg-[#141210]/60 border border-[#1A1614]/5 dark:border-[#2A2522] space-y-3 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95"
              }`}
              style={{ transitionDelay: isVisible ? `${500 + idx * 100}ms` : "0ms" }}
            >
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#1A1614]/40 flex items-center justify-center border border-[#1A1614]/5 dark:border-[#2A2522] shadow-sm">
                <item.icon className="w-6 h-6 text-[#C7A064]" strokeWidth={1.5} />
              </div>
              <p className="text-[#1A1614] dark:text-[#E8E0D4] font-semibold text-lg">
                {item.label}
              </p>
              <p className="text-[#5A5550] dark:text-[#8A8279] text-xs sm:text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
