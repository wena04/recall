import { motion } from "motion/react";
import { Brain, Zap, Shield } from "lucide-react";

export function About() {
  return (
    <section id="about" className="min-h-screen flex items-center justify-center py-20 px-6 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-6xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-6">关于 Recall</h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Recall 是一个革命性的知识管理平台，帮助你捕捉、组织和回忆生活中的每一个重要时刻。
            就像你的第二大脑一样，让信息永不遗忘。
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-purple-500 transition-colors"
          >
            <div className="bg-purple-500/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">智能记忆</h3>
            <p className="text-slate-300">
              使用先进的AI技术，自动分类和标记你的信息，让检索变得更加智能和高效。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-blue-500 transition-colors"
          >
            <div className="bg-blue-500/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">快速检索</h3>
            <p className="text-slate-300">
              瞬间找到你需要的信息，无论是几天前还是几年前保存的内容，都能快速定位。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 hover:border-green-500 transition-colors"
          >
            <div className="bg-green-500/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">安全保护</h3>
            <p className="text-slate-300">
              企业级加密技术保护你的数据安全，确保你的私人信息永远保持私密。
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
