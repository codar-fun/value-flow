import Link from "next/link";
import { UsageGuide } from "../components/usage-guide";
export default function HelpPage() {
  return <main className="join-page"><section className="join-card"><span>FLOW CIRCLE · 使用说明</span><UsageGuide/><Link href="/">← 返回流动圈</Link></section></main>;
}
