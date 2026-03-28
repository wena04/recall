import { motion } from "motion/react";
import { Sparkles, Cloud, Link2, Calendar, Tag, Search } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI 驱动",
    description: "智能分析和自动标签，让你的笔记更有条理",
    color: "purple",
  },
  {
    icon: Cloud,
    title: "云端同步",
    description: "随时随地访问你的知识库，多设备无缝同步",
    color: "blue",
  },
  {
    icon: Link2,
    title: "关联思维",
    description: "建立知识之间的连接，构建你的思维网络",
    color: "green",
  },
  {
    icon: Calendar,
    title: "时间轴视图",
    description: "按时间回顾你的想法演变过程",
    color: "orange",
  },
  {
    icon: Tag,
    title: "灵活标签",
    description: "自定义标签系统，按你的方式组织信息",
    color: "pink",
  },
  {
    icon: Search,
    title: "全文搜索",
    description: "强大的搜索功能，瞬间找到任何内容",
    color: "indigo",
  },
];

const colorMap: Record<string, string> = {
  purple: "from-purple-500 to-purple-700",
  blue: "from-blue-500 to-blue-700",
  green: "from-green-500 to-green-700",
  orange: "from-orange-500 to-orange-700",
  pink: "from-pink-500 to-pink-700",
  indigo: "from-indigo-500 to-indigo-700",
};

export function Features() {
  return (
    <section id="features" className="min-h-screen flex items-center justify-center py-20 px-6 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-7xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold text-white mb-6">强大功能</h2>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
            Recall 提供一整套完整的工具，帮助你更好地管理和利用知识
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:border-white/40 transition-all"
              >
                <div
                  className={`bg-gradient-to-br ${
                    colorMap[feature.color]
                  } rounded-xl w-14 h-14 flex items-center justify-center mb-6`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-purple-100">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
