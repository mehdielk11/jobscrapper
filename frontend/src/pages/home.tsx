import { motion } from 'framer-motion'
import { Globe, Cpu, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

export default function Home() {
  const { user } = useAuth()
  const ctaLink = user ? "/recommendations" : "/login"
  return (
    <div className="w-full flex flex-col gap-24 py-12">
      {/* Hero Section */}
      <section className="relative text-center space-y-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "circOut" }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest mb-4"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Next-Gen AI Matching
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-slate-950 dark:text-white"
        >
          Intelligence for the <br />
          <span className="text-primary italic">Modern Workforce.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl font-medium"
        >
          Bridging the gap between your unique skill profile and the Moroccan job market - connecting talent with the right opportunities, faster and smarter..
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-4"
        >
          <Link to={ctaLink}>
            <Button size="lg" className="rounded-xl px-10 h-14 text-md font-black bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 shadow-2xl shadow-primary/20 atom-hover">
              Get Started
            </Button>
          </Link>
          <Link to={ctaLink}>
            <Button variant="outline" size="lg" className="rounded-xl px-10 h-14 text-md font-bold border-slate-200 dark:border-white/10 text-slate-950 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 atom-hover">
              Live Jobs <ExternalLinkIcon className="ml-2 w-4 h-4 opacity-50" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Trust/Stats Section */}
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 hover:opacity-100 transition-opacity duration-500"
      >
        {[
          { label: "Jobs Scraped", val: "50k+" },
          { label: "Platforms", val: "6" },
          { label: "Skills Indexed", val: "1.2k" },
          { label: "Matches Daily", val: "8k" }
        ].map((s, i) => (
          <motion.div key={i} variants={item} className="text-center space-y-1">
            <div className="text-3xl font-black text-slate-950 dark:text-white">{s.val}</div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "Semantic Analysis",
            desc: "Our NLP engine processes raw job descriptions to extract multi-layer skill requirements.",
            icon: Cpu
          },
          {
            title: "Vector Matching",
            desc: "Cosine similarity algorithms transform your profile into a high-dimensional search vector.",
            icon: BarChart3
          },
          {
            title: "Live Monitoring",
            desc: "Real-time scrapers monitor LinkedIn, ReKrute, and Indeed every 6 hours for fresh opportunities.",
            icon: Globe
          }
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card group p-8 rounded-3xl space-y-6 hover:border-primary/30 transition-all cursor-default"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center border border-slate-300 dark:border-white/5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
              <f.icon className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-950 dark:text-white">{f.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Bottom CTA */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="rounded-[3rem] p-12 bg-gradient-to-br from-primary/10 via-white/50 dark:via-slate-900/50 to-transparent border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-12"
      >
        <div className="space-y-4 text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-950 dark:text-white tracking-tighter">Ready to optimize your career?</h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Join 500+ professionals using JobScraper to find the perfect match.</p>
        </div>
        <Link to={ctaLink}>
          <Button size="lg" className="rounded-2xl px-12 h-16 text-lg font-black bg-primary text-white hover:opacity-90 shadow-2xl shadow-primary/20 atom-hover">
            Join Now
          </Button>
        </Link>
      </motion.section>
    </div>
  )
}

function ExternalLinkIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}
