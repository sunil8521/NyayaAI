"use client";

import { FiArrowRight, FiSearch } from "react-icons/fi";
import { useUIStore } from "@/lib/store";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/auth-client";

const suggested = [
  "Decriminalisation of homosexuality",
  "Validity of triple talaq",
  "Passive euthanasia and living will",
  "Basic structure of the constitution",
  "Dying declaration as the sole basis of conviction",
];

export default function HeroSection() {
  const { searchQuery, setSearchQuery, openAuthModal } = useUIStore();
  const router = useRouter();
  const { data: session } = useSession();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      if (!session?.user) {
        sessionStorage.setItem("pendingQuery", searchQuery.trim());
        openAuthModal("signin");
      } else {
        router.push(`/ask`);
      }
    }
  };

  return (
    <section className="relative bg-[#FAFAFA] dark:bg-[#0C0A09] min-h-dvh flex items-center overflow-hidden transition-colors duration-500 pt-24 lg:pt-12 pb-16 lg:pb-12">
      {/* Decorative Watermark Backgrounds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/svg.png"
          alt=""
          className="absolute -left-16 sm:-left-28 md:-left-44 lg:-left-64 top-1/4 sm:top-1/3 w-48 h-48 sm:w-64 sm:h-64 md:w-[420px] md:h-[420px] lg:w-[600px] lg:h-[600px] object-contain opacity-10 sm:opacity-15 dark:opacity-10 dark:invert dark:brightness-50 transition-all duration-300"
        />
        <img
          src="/nyayaa_classical_column copy.png"
          alt=""
          className="absolute -right-6 sm:-right-12 md:-right-16 lg:-right-24 bottom-0 w-44 h-60 sm:w-64 sm:h-80 md:w-[380px] md:h-[480px] lg:w-[500px] lg:h-[600px] object-contain opacity-10 sm:opacity-15 dark:opacity-10 dark:invert dark:brightness-50 transition-all duration-300"
        />
      </div>
      <div className="max-w-6xl mx-auto px-6 lg:px-8 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8 lg:space-y-10 z-10 py-10 lg:py-20">
            {/* Header Block: Badge + Main Heading */}
            <div className="space-y-3.5">
              {/* Badge */}
              <p className="animate-fade-up text-[#C7A064] font-bold tracking-[0.15em] uppercase text-xs md:text-sm flex items-center gap-3">
                <span className="animate-line-grow delay-300 w-8 h-px bg-[#C7A064]"></span> India's First Free AI Legal Assistant
              </p>

              {/* Headline */}
              <div>
                <h1 className="text-5xl sm:text-6xl lg:text-[4rem] leading-[1.1]">
                  <span className="animate-fade-up delay-100 inline-block font-heading font-normal italic text-[#C7A064]">AI for advocates.</span>
                  <br />
                  <span className="animate-fade-up delay-200 inline-block text-[#1A1614] dark:text-[#E8E0D4] font-bold tracking-tight">Precision in</span>
                  <br />
                  <span className="animate-fade-up delay-300 inline-block text-[#1A1614] dark:text-[#E8E0D4] font-bold tracking-tight">every case.</span>
                </h1>
              </div>
            </div>

            {/* Description */}
            <p className="animate-fade-up delay-400 text-[#5A5550] dark:text-[#8A8279] text-xl leading-relaxed max-w-lg">
              Search judgments, extract legal insights,
              and build stronger arguments in seconds.
            </p>

            {/* Search Bar */}
            <div className="animate-fade-up delay-500 flex items-stretch border border-[#1A1614]/10 dark:border-[#2A2522] rounded-xl overflow-hidden bg-white dark:bg-[#0C0A09] hover:border-[#1A1614]/30 dark:hover:border-[#3A3532] shadow-md transition-all">
              <input
                type="text"
                placeholder="Search judgments"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="flex-1 px-6 py-5 bg-transparent text-[#1A1614] dark:text-[#E8E0D4] text-lg placeholder:text-[#5A5550]/70 dark:placeholder:text-[#5A5550] focus:outline-none"
              />
              <button 
                onClick={handleSearch}
                className="px-8 py-5 text-white transition-colors bg-gray-400 hover:bg-gray-500 dark:bg-[#1A1614]/30 dark:text-[#8A8279] dark:hover:bg-[#1A1614]/50 dark:hover:text-[#E8E0D4] font-semibold flex items-center justify-center"
              >
                <FiArrowRight className="w-6 h-6" />
              </button>
            </div>

            {/* Suggested */}
            <div className="animate-fade-up delay-600 space-y-0 pt-6">
              <p className="text-[#5A5550] text-xs font-bold tracking-[0.2em] uppercase mb-5 flex items-center gap-3">
                <span className="w-6 h-px bg-[#C7A064]"></span> Suggested
              </p>
              <div className="space-y-0 divide-y divide-[#1A1614]/5 dark:divide-[#1A1614]">
                {suggested.map((item, idx) => (
                  <button
                    key={item}
                    onClick={() => setSearchQuery(item)}
                    className="flex items-center justify-between w-full py-4 sm:py-5 text-[#5A5550] dark:text-[#8A8279] text-base hover:text-[#C7A064] dark:hover:text-[#E8E0D4] transition-all duration-300 group text-left animate-fade-in cursor-pointer"
                    style={{ animationDelay: `${700 + idx * 80}ms` }}
                  >
                    <span className="transition-colors group-hover:text-[#1A1614] dark:group-hover:text-[#E8E0D4] pr-4">
                      {item}
                    </span>
                    <FiArrowRight className="w-5 h-5 shrink-0 opacity-100 translate-x-0 text-[#C7A064] md:opacity-0 md:-translate-x-1.5 md:text-current md:group-hover:opacity-100 md:group-hover:translate-x-0 md:group-hover:text-[#C7A064] transition-all duration-300" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Hero Image */}
          <div className="hidden lg:block relative w-full h-175 xl:h-200 mt-10 lg:mt-0 animate-slide-in-right delay-300">
            <div className="relative w-full h-full bg-transparent flex items-center justify-center">
              {/* Image for Light Mode */}
              <img
                src="/ori.png"
                alt="Lady Justice"
                className="dark:hidden w-full h-full object-contain object-right drop-shadow-2xl hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
              {/* Image for Dark Mode */}
              <img
                src="/oriB.png"
                alt="Lady Justice"
                className="hidden dark:block w-full h-full object-contain object-right drop-shadow-2xl hover:scale-[1.02] transition-transform duration-700 ease-out"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
