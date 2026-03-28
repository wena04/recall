import { motion } from "motion/react";
import { Brain, Shield, Zap } from "lucide-react";

export function About() {
  return (
    <section
      id="about"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-20"
    >
      <div className="w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-6 text-5xl font-bold text-white">
            About{" "}
            <span className="bg-gradient-to-r from-orange-200 via-rose-100 to-white bg-clip-text text-transparent">
              Recall
            </span>
          </h2>
          <p className="mx-auto max-w-3xl text-xl text-slate-300">
            Recall is a modern memory platform that helps you capture, organize, and revisit what matters. It works like a second brain, turning scattered information into actionable context.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm transition-colors hover:border-purple-500"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10">
              <Brain className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">Smart Memory</h3>
            <p className="text-slate-300">
              Use AI to automatically structure chats, links, and fragments so retrieval and reflection are faster.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm transition-colors hover:border-blue-500"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <Zap className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              Fast{" "}
              <span className="bg-gradient-to-r from-orange-200 via-rose-100 to-white bg-clip-text text-transparent">
                Recall
              </span>
            </h3>
            <p className="text-slate-300">
              Ideas, places, and action items stay traceable so one question can bring back key context.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm transition-colors hover:border-green-500"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Shield className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">Secure and Controlled</h3>
            <p className="text-slate-300">
              Layered access and storage controls keep private information both usable and protected.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
