import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ExploreSection from "@/components/ExploreSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import Footer from "@/components/Footer";

// ISR: Cache the landing page but re-check every 1 hour.
// This avoids the default 1-year cache (s-maxage=31536000) while
// keeping the performance benefit of not re-rendering on every request.
export const revalidate = 3600; // 1 hour in seconds

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ExploreSection />
        <HowItWorksSection />
      </main>
      <Footer />
    </>
  );
}
