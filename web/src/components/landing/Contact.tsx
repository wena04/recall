import { motion } from "motion/react";
import { Link2, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export function Contact() {
  return (
    <section
      id="contact"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-20"
    >
      <div className="w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-6 text-5xl font-bold text-white">Ready to Recall?</h2>
          <p className="mx-auto max-w-2xl text-xl text-slate-300">
            Start with chats and saved links, then turn fragments into a searchable personal knowledge graph.
          </p>
        </motion.div>

        <div className="grid gap-12 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm"
          >
            <h3 className="mb-6 text-2xl font-bold text-white">Start now</h3>
            <div className="space-y-4">
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700"
              >
                Sign in to Recall
              </Link>
              <Link
                to="/connect"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/70"
              >
                Open connect flow
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              <input
                type="text"
                placeholder="Your name"
                className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="email"
                placeholder="your@email.com"
                className="h-10 w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <textarea
                rows={4}
                placeholder="Tell us what you are building..."
                className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center space-y-8"
          >
            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Mail className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-semibold text-white">Email</h4>
                <p className="text-slate-300">contact@recall.app</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <MessageSquare className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-semibold text-white">Live support</h4>
                <p className="text-slate-300">Daily 9:00 - 18:00</p>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-8">
              <h4 className="mb-4 text-lg font-semibold text-white">Follow us</h4>
              <div className="flex space-x-4">
                {[MessageSquare, Link2, Mail].map((Icon, index) => (
                  <motion.a
                    href="#"
                    key={index}
                    whileHover={{ scale: 1.1 }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 transition-colors hover:bg-purple-600"
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 border-t border-slate-700 pt-8 text-center"
        >
          <p className="text-slate-400">© 2026 Recall. Your second brain for lasting memory.</p>
        </motion.div>
      </div>
    </section>
  );
}
