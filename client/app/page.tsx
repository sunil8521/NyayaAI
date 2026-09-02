import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ExploreSection from "@/components/ExploreSection";
import HowItWorksSection from "@/components/HowItWorksSection";
import Footer from "@/components/Footer";

export const dynamic = 'force-dynamic';

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
