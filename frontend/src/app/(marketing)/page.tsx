'use client';

import React, { useState } from 'react';
import { ArrowRight, MousePointer2, Scroll, Eye, Zap, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  // Mock save function for DB
  const savePreferences = async () => {
    if (!email) return;
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, settings: { optimizeText: true } })
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 selection:bg-blue-100 selection:text-blue-900">



      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-6">
              v1.0.0 Now Available
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
              The Interface That<br />Understands You.
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              AdaptiveWeb detects your micro-behaviors in real-time to provide the right help, exactly when you need it. No configuration required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:scale-105 transition-transform">
                Try Live Demo
              </button>
              <button className="px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-center">
                View Documentation <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Eye, title: "Hover Dwell", desc: "Highlights content when you focus on it." },
              { icon: Scroll, title: "Scroll Back", desc: "Auto-summaries when you review content." },
              { icon: Zap, title: "Rapid Skim", desc: "Condenses text when you scroll fast." },
              { icon: MousePointer2, title: "Cursor Help", desc: "Detects hesitation and offers assistance." }
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all duration-300 group">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                  <f.icon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-slate-500 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo" className="py-24 px-4 bg-slate-100 dark:bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Live Verification Lab</h2>
            <p className="text-slate-600">Ensure the extension is loaded to see these effects.</p>
          </div>

          <div className="space-y-16">

            {/* Demo 1: Hover */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-yellow-100 text-yellow-700 rounded-lg">
                  <Eye size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">1. Hover Dwell Test</h3>
                  <p className="text-slate-500">Hover your mouse over the text below for 2 seconds.</p>
                </div>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed p-4 border border-dashed border-slate-300 rounded-xl" id="hover-target">
                  This is a test paragraph for the Hover Dwell feature. If the AdaptiveWeb extension is working correctly, hovering over this specific block of text for more than 1.5 seconds should trigger a subtle yellow highlight effect, indicating that the system has detected your interest.
                </p>
              </div>
            </div>

            {/* Demo 2 & 3: Scroll & Skim */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-green-100 text-green-700 rounded-lg">
                  <Scroll size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">2. Scroll Dynamics Test</h3>
                  <p className="text-slate-500">Test "Scroll Back Summary" and "Rapid Skim" here.</p>
                </div>
              </div>

              <div className="h-96 overflow-y-auto border border-slate-200 rounded-xl p-6 bg-slate-50 dark:bg-slate-900" id="scroll-container">
                <p className="mb-4 font-medium text-slate-500">--- Start Scrolling Down ---</p>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="mb-8">
                    <h4 className="text-xl font-bold mb-2">Section {i + 1}: Detailed Analysis of User Behavior</h4>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. This paragraph is intentionally long to trigger the skimming detection if you scroll past it very quickly. Try scrolling up and down rapidly to see if the interface adapts.
                    </p>
                    <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                      Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Instruction: 1. Scroll down deep. 2. Stop. 3. Scroll back up quickly. (Should see Summary Box). <br />
                Instruction: Scroll fast through the list to trigger TL;DR collapse.
              </p>
            </div>

            {/* Demo 4: Cursor */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
                  <MousePointer2 size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">3. Cursor Hesitation Test</h3>
                  <p className="text-slate-500">Move your mouse in circles or zig-zags within this area.</p>
                </div>
              </div>
              <div className="h-64 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-purple-200 rounded-xl flex items-center justify-center relative overflow-hidden group hover:border-purple-400 transition-colors">
                <p className="text-slate-400 text-center font-medium pointer-events-none">
                  (Simulate confusion here via mouse movement)
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Backend Integration Demo */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Sync Your Preferences</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Save your behavior profiles to our secure cloud (MongoDB).
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-6 py-3 rounded-xl text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={savePreferences}
              className="px-8 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors"
            >
              {saved ? 'Saved!' : 'Save Config'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-slate-500 text-sm">
        <p>&copy; 2025 AdaptiveWeb. Internal Release.</p>
      </footer>
    </div>
  );
}
