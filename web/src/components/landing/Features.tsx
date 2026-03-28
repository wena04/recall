import { motion } from "motion/react";
import { Calendar, Cloud, Link2, Search, Sparkles, Tag } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI 驱动",
    description: "自动摘要与标签，让你的记忆库持续结构化",
    color: "purple",
  },
  {
    icon: Cloud,
    title: "多端可用",
    description: "Web + iMessage 组合，让输入与提醒都在日常流里发生",
    color: "blue",
  },
  {
    icon: Link2,
    title: "关联回忆",
    description: "把地点、人物、事件连接起来，而不是孤立笔记",
    color: "green",
  },
  {
    icon: Calendar,
    title: "时间线复盘",
    description: "按时间回看你的想法演进和行动轨迹",
    color: "orange",
  },
  {
    icon: Tag,
    title: "分类体系",
    description: "Food / Events / Sports / Ideas / Medical 一致化存储",
    color: "pink",
  },
  {
    icon: Search,
    title: "Mirror Memory",
    description: "通过问答快速召回历史语境和个人风格",
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
    <section
      id="features"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-6 py-20"
    >
      <div className="w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-6 text-5xl font-bold text-white">强大功能</h2>
          <p className="mx-auto max-w-3xl text-xl text-purple-200">
            Recall 提供一整套完整工作流，帮你从信息采集走到可执行回忆。
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
                className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md transition-all hover:border-white/40"
              >
                <div
                  className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${colorMap[feature.color]}`}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">{feature.title}</h3>
                <p className="text-purple-100">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
