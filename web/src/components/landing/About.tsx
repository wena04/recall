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
          <h2 className="mb-6 text-5xl font-bold text-white">关于 Recall</h2>
          <p className="mx-auto max-w-3xl text-xl text-slate-300">
            Recall 是一个革命性的知识管理平台，帮助你捕捉、组织和回忆生活中的每一个重要时刻。像第二大脑一样，让信息持续可回忆、可执行。
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
            <h3 className="mb-4 text-2xl font-bold text-white">智能记忆</h3>
            <p className="text-slate-300">
              利用 AI 自动结构化聊天、链接和碎片信息，让检索和复盘都更快。
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
            <h3 className="mb-4 text-2xl font-bold text-white">快速检索</h3>
            <p className="text-slate-300">
              过去的想法、地点和行动项都可追溯，问一句就能找回关键上下文。
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
            <h3 className="mb-4 text-2xl font-bold text-white">安全可控</h3>
            <p className="text-slate-300">
              通过权限与存储分层管理，确保你的私人信息在可用的同时保持可控。
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
