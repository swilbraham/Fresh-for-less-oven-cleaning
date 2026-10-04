import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import PainPoints from "@/components/sections/PainPoints";
import Benefits from "@/components/sections/Benefits";
import Pricing from "@/components/sections/Pricing";
import Process from "@/components/sections/Process";
import Testimonials from "@/components/sections/Testimonials";
import FAQ from "@/components/sections/FAQ";
import About from "@/components/sections/About";
import FinalCTA from "@/components/sections/FinalCTA";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

/**
 * There is no enquiry form on this page any more.
 *
 * Every route to a price now goes through /book, which prices the job from
 * the published list and puts it in the diary without anybody reading an
 * email. An enquiry form would reintroduce the one manual step the booking
 * system exists to remove, and it offered the customer a worse deal besides:
 * a wait for a callback in place of a price on the spot.
 *
 * The page is a server component as a result, so none of this ships to the
 * browser as JavaScript.
 */
export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <PainPoints />
        <Benefits />
        <Pricing />
        <Process />
        <Testimonials />
        <FAQ />
        <About />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
