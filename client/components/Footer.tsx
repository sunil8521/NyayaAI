"use client";

import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { FaLinkedinIn, FaXTwitter, FaInstagram } from "react-icons/fa6";
import { GoLaw } from "react-icons/go";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Updates", href: "/updates" },
];

const companyLinks = [
  { label: "About", href: "#about" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
];

export default function Footer() {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <footer className="bg-[#FAFAFA] dark:bg-[#0C0A09] border-t border-[#1A1614]/5 dark:border-[#1A1614] transition-colors duration-500">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-16">
        <div
          className={`grid grid-cols-2 md:grid-cols-12 gap-10 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Brand & Socials */}
          <div className="col-span-2 md:col-span-6 pr-4">
            <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
              <GoLaw className="w-8 h-8 text-[#1A1614] dark:text-[#E8E0D4]" />
              <span className="text-[#1A1614] dark:text-[#E8E0D4] font-heading text-3xl font-normal italic">
                Rocky.legal
              </span>
              <span className="text-[#C7A064] ml-1 text-xl">✦</span>
            </Link>
            <p className="text-[#5A5550] dark:text-[#8A8279] text-sm leading-relaxed max-w-[260px] mb-6">
              AI assistant for legal research.
              Built for India. Trusted by legal professionals.
            </p>
            {/* Socials */}
            <div className="flex items-center gap-4">
              <a
                href="#"
                aria-label="LinkedIn"
                className="text-[#0A66C2] md:text-[#5A5550] md:dark:text-[#8A8279] md:hover:text-[#0A66C2] md:dark:hover:text-[#0A66C2] transition-all hover:-translate-y-1 duration-300"
              >
                <FaLinkedinIn className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="X (Twitter)"
                className="text-black dark:text-white md:text-[#5A5550] md:dark:text-[#8A8279] md:hover:text-black md:dark:hover:text-white transition-all hover:-translate-y-1 duration-300"
              >
                <FaXTwitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="text-[#E4405F] md:text-[#5A5550] md:dark:text-[#8A8279] md:hover:text-[#E4405F] md:dark:hover:text-[#E4405F] transition-all hover:-translate-y-1 duration-300"
              >
                <FaInstagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div
            className={`md:col-span-2 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: isVisible ? "150ms" : "0ms" }}
          >
            <h4 className="text-[#1A1614] dark:text-[#E8E0D4] text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="group flex items-center text-[#5A5550] dark:text-[#8A8279] text-sm hover:text-[#C7A064] dark:hover:text-[#E8E0D4] transition-colors w-fit">
                    <span className="relative">
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#C7A064] dark:bg-[#E8E0D4] transition-all duration-300 group-hover:w-full"></span>
                    </span>
                    <FiArrowRight className="w-3 h-3 ml-1.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div
            className={`md:col-span-2 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: isVisible ? "250ms" : "0ms" }}
          >
            <h4 className="text-[#1A1614] dark:text-[#E8E0D4] text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="group flex items-center text-[#5A5550] dark:text-[#8A8279] text-sm hover:text-[#C7A064] dark:hover:text-[#E8E0D4] transition-colors w-fit">
                    <span className="relative">
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#C7A064] dark:bg-[#E8E0D4] transition-all duration-300 group-hover:w-full"></span>
                    </span>
                    <FiArrowRight className="w-3 h-3 ml-1.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div
            className={`md:col-span-2 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: isVisible ? "350ms" : "0ms" }}
          >
            <h4 className="text-[#1A1614] dark:text-[#E8E0D4] text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="group flex items-center text-[#5A5550] dark:text-[#8A8279] text-sm hover:text-[#C7A064] dark:hover:text-[#E8E0D4] transition-colors w-fit">
                    <span className="relative">
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-[#C7A064] dark:bg-[#E8E0D4] transition-all duration-300 group-hover:w-full"></span>
                    </span>
                    <FiArrowRight className="w-3 h-3 ml-1.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-[#1A1614]/10 dark:border-[#1A1614]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5A5550] dark:text-[#8A8279]">
            <p>© 2025 Rocky.legal✦. All rights reserved.</p>
            <p>Made with <span className="text-red-400">♥</span> in India</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
