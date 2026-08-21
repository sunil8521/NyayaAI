"use client";

import { FiSearch, FiFileText, FiLock } from "react-icons/fi";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  {
    icon: FiSearch,
    title: "Faster Research",
    desc: "Find relevant judgments and laws in seconds, not hours.",
  },
  {
    icon: FiFileText,
    title: "Accurate Insights",
    desc: "AI-powered summaries with precise references you can trust.",
  },
  {
    icon: FiLock,
    title: "Confidential & Secure",
    desc: "Your searches are private and your data is encrypted.",
  },
];

export default function ExploreSection() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section id="features" className="relative bg-[#FAFAFA] dark:bg-[#0C0A09] py-24 lg:py-32 transition-colors duration-500 border-t border-[#1A1614]/5 dark:border-transparent overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/bank.png"
          alt=""
          className="absolute -top-6 sm:-top-10 md:top-1/4 -right-8 sm:-right-14 md:-right-20 lg:-right-24 w-44 h-44 sm:w-60 sm:h-60 md:w-[360px] md:h-[360px] lg:w-[450px] lg:h-[450px] object-contain opacity-10 sm:opacity-15 dark:opacity-10 dark:invert dark:brightness-50 transition-all duration-300"
        />
      </div>
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <h2
          className={`text-4xl sm:text-5xl mb-20 text-[#1A1614] dark:text-[#E8E0D4] transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="font-bold">Why </span>
          <span className="font-heading font-normal italic text-[#C7A064]">NyayaAI</span>
          <span className="font-bold"> ?</span>
        </h2>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-16">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              className={`space-y-5 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: isVisible ? `${200 + idx * 150}ms` : "0ms" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1A1614]/30 flex items-center justify-center border border-[#1A1614]/5 dark:border-[#2A2522] shadow-sm">
                <feature.icon className="w-8 h-8 text-[#C7A064]" strokeWidth={1.5} />
              </div>
              <h3 className="text-[#1A1614] dark:text-[#E8E0D4] font-bold text-2xl">
                {feature.title}
              </h3>
              <p className="text-[#5A5550] dark:text-[#8A8279] text-base leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
