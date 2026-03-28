import { motion } from "motion/react";
import { Mail, MessageSquare, Twitter, Github } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function Contact() {
  return (
    <section id="contact" className="min-h-screen flex items-center justify-center py-20 px-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-6">联系我们</h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            有任何问题或建议？我们很乐意听到你的声音
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700"
          >
            <h3 className="text-2xl font-bold text-white mb-6">发送消息</h3>
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  姓名
                </label>
                <Input
                  type="text"
                  placeholder="你的姓名"
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  邮箱
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  消息
                </label>
                <textarea
                  rows={4}
                  placeholder="告诉我们你的想法..."
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                发送消息
              </Button>
            </form>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center space-y-8"
          >
            <div className="flex items-start space-x-4">
              <div className="bg-purple-500/10 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-1">邮箱</h4>
                <p className="text-slate-300">contact@recall.app</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-blue-500/10 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-1">在线客服</h4>
                <p className="text-slate-300">每天 9:00 - 18:00</p>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-700">
              <h4 className="text-lg font-semibold text-white mb-4">关注我们</h4>
              <div className="flex space-x-4">
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  className="bg-slate-700 rounded-full w-12 h-12 flex items-center justify-center hover:bg-purple-600 transition-colors"
                >
                  <Twitter className="w-5 h-5 text-white" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  className="bg-slate-700 rounded-full w-12 h-12 flex items-center justify-center hover:bg-purple-600 transition-colors"
                >
                  <Github className="w-5 h-5 text-white" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  className="bg-slate-700 rounded-full w-12 h-12 flex items-center justify-center hover:bg-purple-600 transition-colors"
                >
                  <MessageSquare className="w-5 h-5 text-white" />
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-16 pt-8 border-t border-slate-700"
        >
          <p className="text-slate-400">
            © 2026 Recall. 你的第二大脑，让记忆永存。
          </p>
        </motion.div>
      </div>
    </section>
  );
}
