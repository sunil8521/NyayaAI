"use client";

import { FiUsers, FiBookOpen, FiSearch, FiAward } from "react-icons/fi";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const audiences = [
  { icon: FiUsers, label: "Advocates", desc: "Solo practitioners & senior advocates" },
  { icon: FiBookOpen, label: "Law Firms", desc: "Teams of all sizes" },
  { icon: FiSearch, label: "Legal Researchers", desc: "Scholars & policy analysts" },
  { icon: FiAward, label: "Students", desc: "Law students & interns" },
];

export default function HowItWorksSection() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section id="about" className="relative bg-[#FAFAFA] dark:bg-[#0C0A09] border-t border-[#1A1614]/5 dark:border-[#1A1614] py-24 lg:py-32 transition-colors duration-500 overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/nyayaa_scales_of_justice.png"
          alt=""
          className="absolute -bottom-8 sm:-bottom-12 md:-bottom-16 lg:-bottom-20 right-0 sm:right-4 md:right-8 lg:right-auto lg:left-0 w-36 h-52 sm:w-56 sm:h-72 md:w-64 md:h-88 lg:w-[300px] lg:h-[480px] object-contain opacity-[0.06] sm:opacity-[0.08] dark:opacity-[0.05] dark:invert dark:brightness-50 transition-all duration-300 pointer-events-none"
        />
      </div>
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <h2
          className={`text-4xl sm:text-5xl mb-20 text-[#1A1614] dark:text-[#E8E0D4] transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
        >
          <span className="font-bold">Built for </span>
          <span className="font-heading font-normal italic text-[#C7A064]">legal professionals</span>
        </h2>

        {/* Audience Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-16">
          {audiences.map((item, idx) => (
            <div
              key={item.label}
              className={`space-y-4 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95"
                }`}
              style={{ transitionDelay: isVisible ? `${200 + idx * 120}ms` : "0ms" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1A1614]/30 flex items-center justify-center border border-[#1A1614]/5 dark:border-[#2A2522] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <item.icon className="w-8 h-8 text-[#C7A064]" strokeWidth={1.5} />
              </div>
              <p className="text-[#1A1614] dark:text-[#E8E0D4] font-semibold text-xl">
                {item.label}
              </p>
              <p className="text-[#5A5550] dark:text-[#8A8279] text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
